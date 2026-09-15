import { McpServer } from '@modelcontextprotocol/server'
import { createMcpHandler } from 'agents/mcp/server'
import { brotliCompressSync, brotliDecompressSync, constants, gunzipSync } from 'node:zlib'
import { z } from 'zod'

const BROTLI_AUTO_THRESHOLD = 2048

interface Env {
  ASSETS: Fetcher
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    if (url.pathname === '/mcp') {
      return createMcpHandler(() => createMcpServer(url.origin))(request, env, ctx)
    }

    if (url.pathname === '/human' || url.pathname === '/human/') {
      url.pathname = '/'
      return Response.redirect(url.toString(), 308)
    }

    const response = await env.ASSETS.fetch(request)
    if (url.pathname !== '/' || !hasPayload(url.searchParams)) return response

    let text: string
    try {
      text = decodeReferenceText(url.searchParams)
    } catch {
      return response
    }

    const algo = url.searchParams.get('algo') || 'plain'
    return new HTMLRewriter()
      .on('#reader', {
        element(element) {
          element.removeAttribute('hidden')
        },
      })
      .on('#content', {
        element(element) {
          element.setInnerContent(text)
        },
      })
      .on('#meta', {
        element(element) {
          element.setInnerContent(`${new TextEncoder().encode(text).byteLength} B · ${algo}`)
        },
      })
      .transform(response)
  },
} satisfies ExportedHandler<Env>

function hasPayload(params: URLSearchParams): boolean {
  return params.has('q') || params.has('content')
}

export function decodeReferenceText(params: URLSearchParams): string {
  const payload = params.get('q') ?? params.get('content') ?? ''
  const algo = params.get('algo') || 'plain'

  if (algo === 'plain') return payload

  const bytes = base64UrlToBytes(payload)
  if (algo === 'gzip') return new TextDecoder().decode(gunzipSync(bytes))
  if (algo === 'br') return new TextDecoder().decode(brotliDecompressSync(bytes))

  throw new Error(`Unsupported algorithm: ${algo}`)
}

function createMcpServer(origin: string): McpServer {
  const server = new McpServer({ name: 'cita', version: '0.2.0' })

  server.registerTool(
    'create_reference',
    {
      description:
        'Convert auxiliary text into a self-contained Cita citation URL. The tool automatically chooses plain URL encoding, gzip, or Brotli based on the resulting URL length.',
      inputSchema: {
        content: z
          .string()
          .min(1)
          .describe('The complete text to embed in the citation URL.'),
      },
    },
    async ({ content }) => ({
      content: [{ type: 'text', text: await createReferenceUrl(origin, content) }],
    }),
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

  return `${origin}/?${params}`
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

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}
