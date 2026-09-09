import { expect, test } from 'bun:test'
import { brotliDecompressSync } from 'node:zlib'
import { decodePayload, encodePayload } from '../site/codec.js'
import { createReferenceUrl } from './index'

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
  expect(await decode(mediumUrl)).toBe(medium)
  expect(await decode(largeUrl)).toBe(large)
  expect(await decodePayload(new URL(largeUrl).searchParams)).toBe(large)

  const browserAuto = await encodePayload(large)
  expect(browserAuto.algo).toBe('br')
})
