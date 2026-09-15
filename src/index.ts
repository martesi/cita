import { McpServer } from '@modelcontextprotocol/server'
import { createMcpHandler } from 'agents/mcp/server'
import { brotliCompressSync, constants } from 'node:zlib'
import { z } from 'zod'

const BROTLI_AUTO_THRESHOLD = 2048

interface Env {
  ASSETS: Fetcher
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    if (url.pathname === '/mcp' || url.pathname === '/api/mcp') {
      return createMcpHandler(
        () => createMcpServer(url.origin),
        { route: url.pathname },
      )(request, env, ctx)
    }

    if (url.pathname === '/human' || url.pathname === '/human/') {
      url.pathname = '/'
      return Response.redirect(url.toString(), 308)
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>

function createMcpServer(origin: string): McpServer {
  const server = new McpServer({ name: 'cita', version: '0.2.0' })
  const defaultBase = process.env.CITA_BASE_URL || origin

  server.registerTool(
    'create_reference',
    {
      description:
        'Convert source URLs into self-contained Cita citation URLs. Each result contains either a citation URL or a reason when that source cannot be converted.',
      inputSchema: {
        urls: z.array(z.string()).min(1).describe('Source URLs to convert.'),
        base: z
          .string()
          .url()
          .optional()
          .describe('Cita base URL. Defaults to CITA_BASE_URL from the build environment.'),
      },
      outputSchema: {
        results: z.array(
          z.union([
            z.object({ url: z.string() }),
            z.object({ reason: z.string() }),
          ]),
        ),
      },
    },
    async ({ urls, base }) => {
      const result = {
        results: await Promise.all(
          urls.map(async (source) => {
            try {
              const sourceUrl = new URL(source)
              return { url: await createReferenceUrl(base || defaultBase, sourceUrl.toString()) }
            } catch (error) {
              return { reason: error instanceof Error ? error.message : 'Invalid URL' }
            }
          }),
        ),
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result,
      }
    },
  )

  return server
}

export async function createReferenceUrl(origin: string, content: string): Promise<string> {
  const plain = new URLSearchParams({ q: content })
  const gzipParams = new URLSearchParams({
    algo: 'gzip',
    q: bytesToBase64Url(await gzip(content)),
  })
  let params = shorter(plain, gzipParams)

  if (params.toString().length >= BROTLI_AUTO_THRESHOLD) {
    const brotliParams = new URLSearchParams({
      algo: 'br',
      q: bytesToBase64Url(brotli(content)),
    })
    params = shorter(params, brotliParams)
  }

  return `${origin.replace(/\/+$/, '')}/?${params}`
}

function shorter(left: URLSearchParams, right: URLSearchParams): URLSearchParams {
  return right.toString().length < left.toString().length ? right : left
}

function brotli(content: string): Uint8Array {
  return brotliCompressSync(new TextEncoder().encode(content), {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11,
    },
  })
}

async function gzip(content: string): Promise<Uint8Array> {
  const stream = new Blob([new TextEncoder().encode(content)])
    .stream()
    .pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }

  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}