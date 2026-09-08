const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function compressionAvailable() {
  return 'CompressionStream' in globalThis && 'DecompressionStream' in globalThis
}

export async function decodePayload(searchParams) {
  const payload = searchParams.get('q') ?? searchParams.get('content') ?? ''
  const algo = searchParams.get('algo') || 'plain'

  if (algo === 'plain') return payload
  if (algo !== 'gzip') throw new Error(`Unsupported algorithm: ${algo}`)
  if (!compressionAvailable()) {
    throw new Error('This browser does not support compressed Cita links.')
  }

  const compressed = base64UrlToBytes(payload)
  const stream = new Blob([compressed])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'))
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer())
  return decoder.decode(bytes)
}

export async function encodePayload(text, requestedAlgo = 'auto') {
  const plain = new URLSearchParams({ q: text })
  if (requestedAlgo === 'plain' || !compressionAvailable()) {
    return { params: plain, algo: 'plain' }
  }

  const compressed = await gzip(text)
  const gzipParams = new URLSearchParams({
    algo: 'gzip',
    q: bytesToBase64Url(compressed),
  })

  if (requestedAlgo === 'gzip') return { params: gzipParams, algo: 'gzip' }

  return gzipParams.toString().length < plain.toString().length
    ? { params: gzipParams, algo: 'gzip' }
    : { params: plain, algo: 'plain' }
}

export function utf8ByteLength(text) {
  return encoder.encode(text).byteLength
}

async function gzip(text) {
  const stream = new Blob([encoder.encode(text)])
    .stream()
    .pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function bytesToBase64Url(bytes) {
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

function base64UrlToBytes(value) {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}
