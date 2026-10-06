import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { version } from '../package.json' with { type: 'json' }
import { createReferenceUrl, type RenderMode } from '../skill/scripts/core'

export const handler = createMcpHandler(({ requestInfo }) =>
  createCitaServer(requestInfo ? new URL(requestInfo.url).origin : ''),
)

export function createCitaServer(origin = ''): McpServer {
  const server = new McpServer({ name: 'cita', version })
  const defaultBase = process.env.CITA_BASE_URL || origin

  server.registerTool(
    'create_reference',
    {
      description:
        'Convert source content into self-contained Cita citation URLs. Content that only contains a URL is refused; fetch the source text first.',
      inputSchema: z.object({
        contents: z.array(z.string()).min(1).describe('Source content to convert.'),
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
    async ({ contents, base, render }) => {
      const result = {
        results: await Promise.all(
          contents.map(async (content) => {
            if (!content.trim()) {
              return { reason: 'Content must include source text' }
            }
            if (isUrlOnly(content)) {
              return { reason: 'Content must include source text, not only a URL' }
            }

            try {
              return {
                url: await createReferenceUrl(
                  base || defaultBase,
                  content,
                  render as RenderMode | undefined,
                ),
              }
            } catch (error) {
              return { reason: error instanceof Error ? error.message : 'Invalid content' }
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

function isUrlOnly(content: string): boolean {
  const value = content.trim()
  // URL parsing accepts spaces in custom schemes and removes tabs/newlines.
  if (/\s/u.test(value)) return false
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}
