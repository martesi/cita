import { brotliCompressSync, constants } from 'node:zlib'

const BROTLI_AUTO_THRESHOLD = 2048
const MAX_URL_BYTES = 32 * 1024

export type RenderMode = 'md'

export async function createReferenceUrl(
  origin: string,
  content: string,
  render?: RenderMode,
): Promise<string> {
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

  if (render) params.set('render', render)

  const url = `${origin.replace(/\/+$/, '')}/?${params}`
  if (new TextEncoder().encode(url).byteLength > MAX_URL_BYTES) {
    throw new Error(`Citation URL exceeds ${MAX_URL_BYTES} bytes`)
  }

  return url
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
