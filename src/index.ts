import { McpServer } from '@modelcontextprotocol/server'
import { createMcpHandler } from 'agents/mcp/server'
import { z } from 'zod'

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
        'Convert auxiliary text into a self-contained Cita citation URL. The tool automatically uses plain URL encoding or gzip compression, whichever produces the shorter URL.',
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
  const compressed = new URLSearchParams({
    algo: 'gzip',
    q: bytesToBase64Url(await gzip(content)),
  })
  const params = compressed.toString().length < plain.toString().length
    ? compressed
    : plain

  return `${origin}/?${params}`
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
