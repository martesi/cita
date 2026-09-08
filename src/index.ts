import { McpServer } from '@modelcontextprotocol/server'
import { createMcpHandler } from 'agents/mcp/server'
import { z } from 'zod'

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60
const MAX_TTL_SECONDS = 30 * 24 * 60 * 60
const MAX_CONTENT_BYTES = 256 * 1024

interface Env {
  ASSETS: Fetcher
  DB: D1Database
}

interface ReferenceRow {
  id: string
  content: string
  created_at: number
  expires_at: number
  bytes: number
}

const createReferenceInput = z.object({
  content: z.string().min(1),
  ttl_seconds: z
    .number()
    .int()
    .min(60)
    .max(MAX_TTL_SECONDS)
    .optional(),
})

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    if (url.pathname === '/mcp') {
      const handler = createMcpHandler(() => createMcpServer(env, url.origin))
      return handler(request, env, ctx)
    }

    if (url.pathname === '/api/references' && request.method === 'POST') {
      return createReferenceResponse(request, env, url.origin)
    }

    const referenceRoute = parseReferenceRoute(url.pathname)
    if (referenceRoute && request.method === 'GET') {
      return referenceRoute.human
        ? humanReferenceResponse(env, referenceRoute.id)
        : citationReferenceResponse(env, referenceRoute.id)
    }

    return env.ASSETS.fetch(request)
  },

  async scheduled(_controller, env) {
    await env.DB.prepare('DELETE FROM refs WHERE expires_at <= ?')
      .bind(nowSeconds())
      .run()
  },
} satisfies ExportedHandler<Env>

function createMcpServer(env: Env, origin: string): McpServer {
  const server = new McpServer({ name: 'cita', version: '0.1.0' })

  server.registerTool(
    'create_reference',
    {
      description:
        'Store auxiliary text outside the main answer and return a short public URL suitable for use as a citation. Use this when detailed content should remain available to a human reader without occupying the main response.',
      inputSchema: {
        content: z
          .string()
          .min(1)
          .describe('The complete text to store in the reference.'),
        ttl_seconds: z
          .number()
          .int()
          .min(60)
          .max(MAX_TTL_SECONDS)
          .optional()
          .describe(
            `Optional lifetime in seconds. Defaults to ${DEFAULT_TTL_SECONDS}.`,
          ),
      },
    },
    async (input) => {
      const result = await storeReference(
        env,
        origin,
        input.content,
        input.ttl_seconds,
      )

      return {
        content: [{ type: 'text', text: result.url }],
      }
    },
  )

  return server
}

async function createReferenceResponse(
  request: Request,
  env: Env,
  origin: string,
): Promise<Response> {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return jsonError('Request body must be valid JSON.', 400)
  }

  const parsed = createReferenceInput.safeParse(body)
  if (!parsed.success) {
    return jsonError('Invalid reference payload.', 400)
  }

  try {
    const result = await storeReference(
      env,
      origin,
      parsed.data.content,
      parsed.data.ttl_seconds,
    )
    return Response.json(result, { status: 201 })
  } catch (error) {
    return jsonError(errorMessage(error), 400)
  }
}

async function storeReference(
  env: Env,
  origin: string,
  content: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
) {
  const bytes = new TextEncoder().encode(content).byteLength
  if (bytes > MAX_CONTENT_BYTES) {
    throw new Error(
      `Reference is too large. Maximum size is ${MAX_CONTENT_BYTES} bytes.`,
    )
  }

  const id = randomId()
  const createdAt = nowSeconds()
  const expiresAt = createdAt + ttlSeconds

  await env.DB.prepare(
    'INSERT INTO refs (id, content, created_at, expires_at, bytes) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(id, content, createdAt, expiresAt, bytes)
    .run()

  return {
    id,
    url: `${origin}/r/${id}`,
    expires_in: ttlSeconds,
    bytes,
  }
}

async function citationReferenceResponse(
  env: Env,
  id: string,
): Promise<Response> {
  const row = await env.DB.prepare(
    'SELECT id, expires_at FROM refs WHERE id = ? LIMIT 1',
  )
    .bind(id)
    .first<{ id: string; expires_at: number }>()

  if (!row || row.expires_at <= nowSeconds()) {
    if (row) await deleteReference(env, id)
    return notFoundReferenceResponse()
  }

  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Cita</title></head><body><p>Cita reference is available. New here? Read <a href="/llms.txt">llms.txt</a>. Need the payload? Open <code>./human</code>.</p><script>location.replace(location.pathname.replace(/\/?$/, '/human')+location.search+location.hash)</script></body></html>`,
    { headers: htmlHeaders('public, max-age=60') },
  )
}

async function humanReferenceResponse(
  env: Env,
  id: string,
): Promise<Response> {
  const row = await env.DB.prepare(
    'SELECT id, content, created_at, expires_at, bytes FROM refs WHERE id = ? LIMIT 1',
  )
    .bind(id)
    .first<ReferenceRow>()

  if (!row || row.expires_at <= nowSeconds()) {
    if (row) await deleteReference(env, id)
    return notFoundReferenceResponse()
  }

  const content = escapeHtml(row.content)
  const createdAt = escapeHtml(new Date(row.created_at * 1000).toISOString())

  return new Response(
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Cita</title>
<link rel="stylesheet" href="/style.css">
</head>
<body>
<main>
<header><a class="brand" href="/">cita</a><span class="muted">stored reference</span></header>
<section class="panel">
<div class="toolbar"><span id="meta">${row.bytes} B · ${createdAt}</span><button id="copy-text" type="button">Copy text</button><button id="copy-link" type="button">Copy citation</button></div>
<article id="content">${content}</article>
</section>
<p id="status" role="status" aria-live="polite"></p>
</main>
<script>
const status=document.querySelector('#status');
document.querySelector('#copy-text').addEventListener('click',async()=>{await navigator.clipboard.writeText(document.querySelector('#content').textContent);status.textContent='Text copied.'});
document.querySelector('#copy-link').addEventListener('click',async()=>{await navigator.clipboard.writeText(location.href.replace(/\/human\/?$/,''));status.textContent='Citation copied.'});
</script>
</body>
</html>`,
    { headers: htmlHeaders('private, no-store') },
  )
}

async function deleteReference(env: Env, id: string): Promise<void> {
  await env.DB.prepare('DELETE FROM refs WHERE id = ?').bind(id).run()
}

function parseReferenceRoute(pathname: string) {
  const match = pathname.match(/^\/r\/([A-Za-z0-9_-]{12})(\/human)?\/?$/)
  if (!match) return null

  return {
    id: match[1],
    human: Boolean(match[2]),
  }
}

function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)

  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

function notFoundReferenceResponse(): Response {
  return new Response('Reference not found or expired.', {
    status: 404,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
    },
  })
}

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status })
}

function htmlHeaders(cacheControl: string): HeadersInit {
  return {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': cacheControl,
    'x-robots-tag': 'noindex',
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[character] ?? character
  })
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to create reference.'
}
