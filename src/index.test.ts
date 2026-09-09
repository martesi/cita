import { expect, test } from 'bun:test'
import { createReferenceUrl } from './index'

async function decode(urlString: string): Promise<string> {
  const url = new URL(urlString)
  const payload = url.searchParams.get('q') ?? ''

  if (url.searchParams.get('algo') !== 'gzip') return payload

  const base64 = payload.replaceAll('-', '+').replaceAll('_', '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new TextDecoder().decode(await new Response(stream).arrayBuffer())
}

test('creates self-contained plain and gzip references', async () => {
  const short = 'hola mundo'
  const long = `${'Repeated reference content. '.repeat(20)}你好世界`.trim()
  const shortUrl = await createReferenceUrl('https://cita.example', short)
  const longUrl = await createReferenceUrl('https://cita.example', long)

  expect(new URL(shortUrl).searchParams.get('algo')).toBeNull()
  expect(new URL(longUrl).searchParams.get('algo')).toBe('gzip')
  expect(await decode(shortUrl)).toBe(short)
  expect(await decode(longUrl)).toBe(long)
})
