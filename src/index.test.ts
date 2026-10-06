import { expect, test } from 'bun:test'
import { brotliDecompressSync } from 'node:zlib'
import { decodePayload, encodePayload } from '../site/codec.js'
import { createReferenceUrl } from '../skill/scripts/core'
import { handler } from './mcp'

async function callMcp(contents: string[]) {
  const response = await handler.fetch(new Request('https://cita.example/api/mcp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2025-06-18',
    },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'tools/call',
      params: { name: 'create_reference', arguments: { contents } },
    }),
  }))
  expect(response.status).toBe(200)
  const message = (await response.text()).split('\n').find((line) => line.startsWith('data: '))
  if (!message) throw new Error('Missing MCP response')
  const result = JSON.parse(message.slice(6)).result
  expect(result.isError).not.toBe(true)
  return result.structuredContent.results
}

async function decode(urlString: string): Promise<string> {
  const url = new URL(urlString)
  const payload = url.searchParams.get('q') ?? ''
  const algo = url.searchParams.get('algo')

  if (!algo) return payload

  const base64 = payload.replaceAll('-', '+').replaceAll('_', '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
  if (algo === 'br') return new TextDecoder().decode(brotliDecompressSync(bytes))

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new TextDecoder().decode(await new Response(stream).arrayBuffer())
}

test('auto selects plain, gzip, and Brotli as useful', async () => {
  const short = 'hola mundo'
  const medium = `${'Repeated reference content. '.repeat(20)}你好世界`.trim()
  const large = Array.from(
    { length: 1800 },
    (_, index) => `record-${index.toString(36)}:${Math.imul(index, 2654435761).toString(36)}`,
  ).join('|')

  const shortUrl = await createReferenceUrl('https://cita.example', short)
  const mediumUrl = await createReferenceUrl('https://cita.example', medium)
  const largeUrl = await createReferenceUrl('https://cita.example', large)

  expect(new URL(shortUrl).searchParams.get('algo')).toBeNull()
  expect(new URL(mediumUrl).searchParams.get('algo')).toBe('gzip')
  expect(new URL(largeUrl).searchParams.get('algo')).toBe('br')
  expect(await decode(shortUrl)).toBe(short)
  expect(await decodePayload(new URL(largeUrl).searchParams)).toBe(large)

  const browserAuto = await encodePayload(large)
  expect(browserAuto.algo).toBe('br')
})

test('adds markdown render mode when requested', async () => {
  const url = new URL(await createReferenceUrl('https://cita.example', '# heading', 'md'))
  expect(url.searchParams.get('render')).toBe('md')
  expect(await decode(url.toString())).toBe('# heading')
})

test('rejects citation URLs over 32 KiB', async () => {
  const oversizedBase = `https://cita.example/${'x'.repeat(32 * 1024)}`

  await expect(createReferenceUrl(oversizedBase, 'x')).rejects.toThrow(
    'Citation URL exceeds 32768 bytes',
  )
})

test('MCP preserves source prose containing colons, URLs, and whitespace', async () => {
  const contents = [
    'Source: This paragraph contains source text.',
    'https://example.com/\nThis is a source excerpt.',
    'https://example.com/ This is a source excerpt.',
    '  Source text with Unicode: 你好世界\t\n',
  ]
  const results = await callMcp(contents)
  expect(results).toHaveLength(contents.length)
  for (const [index, result] of results.entries()) {
    expect(await decode(result.url)).toBe(contents[index])
  }
})

test('MCP still refuses standalone URLs', async () => {
  const contents = [
    'https://example.com/',
    ' \nhttps://example.com/a%20b\t ',
    'http://example.com/?q=source#text',
    'mailto:reader@example.com',
  ]
  expect(await callMcp(contents)).toEqual(contents.map(() => ({
    reason: 'Content must include source text, not only a URL',
  })))
})

test('MCP rejects blank items without blocking valid source content', async () => {
  const results = await callMcp(['', ' \t\n', '\u00a0', 'Source text.'])
  expect(results.slice(0, 3)).toEqual(Array(3).fill({ reason: 'Content must include source text' }))
  expect(await decode(results[3].url)).toBe('Source text.')
})
