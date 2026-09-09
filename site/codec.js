const encoder = new TextEncoder()
const decoder = new TextDecoder()
const BROTLI_AUTO_THRESHOLD = 2048

export function compressionAvailable() {
  return 'CompressionStream' in globalThis && 'DecompressionStream' in globalThis
}

export async function decodePayload(searchParams) {
  const payload = searchParams.get('q') ?? searchParams.get('content') ?? ''
  const algo = searchParams.get('algo') || 'plain'

  if (algo === 'plain') return payload

  const compressed = base64UrlToBytes(payload)
  if (algo === 'gzip') return decoder.decode(await decompressStream(compressed, 'gzip'))
  if (algo === 'br') return decoder.decode(await brotliDecompress(compressed))

  throw new Error(`Unsupported algorithm: ${algo}`)
}

export async function encodePayload(text, requestedAlgo = 'auto') {
  const plain = candidate('plain', new URLSearchParams({ q: text }))
  if (requestedAlgo === 'plain' || !compressionAvailable()) return plain

  const gzipCandidate = candidate(
    'gzip',
    new URLSearchParams({ algo: 'gzip', q: bytesToBase64Url(await gzip(text)) }),
  )

  if (requestedAlgo === 'gzip') return gzipCandidate
  if (requestedAlgo === 'br') return brotliCandidate(text)

  const best = shorter(plain, gzipCandidate)
  if (best.params.toString().length < BROTLI_AUTO_THRESHOLD) return best

  return shorter(best, await brotliCandidate(text))
}

export function utf8ByteLength(text) {
  return encoder.encode(text).byteLength
}

function candidate(algo, params) {
  return { algo, params }
}

function shorter(left, right) {
  return right.params.toString().length < left.params.toString().length ? right : left
}

async function gzip(text) {
  return compressStream(text, 'gzip')
}

async function compressStream(text, format) {
  const stream = new Blob([encoder.encode(text)])
    .stream()
    .pipeThrough(new CompressionStream(format))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function decompressStream(bytes, format) {
  if (!compressionAvailable()) {
    throw new Error('This browser does not support compressed Cita links.')
  }

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function brotliCandidate(text) {
  let compressed

  try {
    compressed = await compressStream(text, 'brotli')
  } catch {
    const { default: brotliPromise } = await import('brotli-wasm')
    const brotli = await brotliPromise
    compressed = brotli.compress(encoder.encode(text), { quality: 11 })
  }

  return candidate(
    'br',
    new URLSearchParams({ algo: 'br', q: bytesToBase64Url(compressed) }),
  )
}

async function brotliDecompress(bytes) {
  try {
    return await decompressStream(bytes, 'brotli')
  } catch {
    const { default: brotliPromise } = await import('brotli-wasm')
    const brotli = await brotliPromise
    return brotli.decompress(bytes)
  }
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
