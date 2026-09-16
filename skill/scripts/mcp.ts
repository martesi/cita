import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { createReferenceUrl, type RenderMode } from './core'

export const handler = createMcpHandler(({ requestInfo }) =>
  createCitaServer(requestInfo ? new URL(requestInfo.url).origin : ''),
)

export function createCitaServer(origin = ''): McpServer {
  const server = new McpServer({ name: 'cita', version: '0.3.0' })
  const defaultBase = process.env.CITA_BASE_URL || origin

  server.registerTool(
    'create_reference',
    {
      description:
        'Convert source URLs into self-contained Cita citation URLs. Each result contains either a citation URL or a reason when that source cannot be converted.',
      inputSchema: z.object({
        urls: z.array(z.string()).min(1).describe('Source URLs to convert.'),
        base: z
          .string()
          .url()
          .optional()
          .describe('Cita base URL. Defaults to CITA_BASE_URL or the request origin.'),
        render: z
          .enum(['md'])
          .optional()
          .describe('Optional render mode applied to every generated URL. Use md for Markdown.'),
      }),
      outputSchema: z.object({
        results: z.array(
          z.union([
            z.object({ url: z.string() }),
            z.object({ reason: z.string() }),
          ]),
        ),
      }),
    },
    async ({ urls, base, render }) => {
      const result = {
        results: await Promise.all(
          urls.map(async (source) => {
            try {
              const sourceUrl = new URL(source)
              return {
                url: await createReferenceUrl(
                  base || defaultBase,
                  sourceUrl.toString(),
                  render as RenderMode | undefined,
                ),
              }
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
