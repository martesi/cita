import { McpServer } from '@modelcontextprotocol/server'
import { createMcpHandler } from 'agents/mcp/server'
import { brotliCompressSync, constants } from 'node:zlib'
import { z } from 'zod'

const BROTLI_AUTO_THRESHOLD = 2048

interface Env {
  ASSETS: Fetcher
}

export default {
  fetch(request, env, ctx) {
    const url = new URL(request.url)

    if (url.pathname === '/mcp') {
      return createMcpHandler(() => createMcpServer(url.origin))(request, env, ctx)
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>

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
