import {
  compressionAvailable,
  decodePayload,
  encodePayload,
  utf8ByteLength,
} from './codec.js'

const params = new URLSearchParams(location.search)
const reader = document.querySelector('#reader')
const editor = document.querySelector('#editor')
const content = document.querySelector('#content')
const input = document.querySelector('#input')
const algoSelect = document.querySelector('#algo')
const meta = document.querySelector('#meta')
const status = document.querySelector('#status')
const copyTextButton = document.querySelector('#copy-text')
const copyLinkButton = document.querySelector('#copy-link')
const editButton = document.querySelector('#edit')
const newButton = document.querySelector('#new')
const generateButton = document.querySelector('#generate')

let currentText = ''

init().catch(showError)

async function init() {
  if (!compressionAvailable()) {
    algoSelect.querySelector('option[value="gzip"]').disabled = true
  }

  const payload = params.get('q') ?? params.get('content')
  if (!payload) {
    showEditor('')
    return
  }

  currentText = await decodePayload(params)
  showReader(currentText, params.get('algo') || 'plain')
}

function citationBaseUrl() {
  const url = new URL(location.href)
  url.pathname = url.pathname.replace(/human\/?$/, '')
  url.search = ''
  url.hash = ''
  return url
}

function citationUrl(searchParams = params) {
  const url = citationBaseUrl()
  url.search = searchParams.toString()
  return url.toString()
}

function showReader(text, algo) {
  currentText = text
  content.textContent = text
  reader.hidden = false
  editor.hidden = true
  meta.textContent = `${formatBytes(utf8ByteLength(text))} · ${algo}`
  setStatus('')
}

function showEditor(text) {
  input.value = text
  reader.hidden = true
  editor.hidden = false
  input.focus()
  setStatus('')
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
}

function setStatus(message) {
  status.textContent = message
}

function showError(error) {
  const message = error instanceof Error ? error.message : String(error)
  showEditor(currentText)
  setStatus(message)
}

async function copy(value, label) {
  await navigator.clipboard.writeText(value)
  setStatus(`${label} copied.`)
}

copyTextButton.addEventListener('click', () => {
  copy(currentText, 'Text').catch(showError)
})

copyLinkButton.addEventListener('click', () => {
  copy(citationUrl(), 'Citation').catch(showError)
})

editButton.addEventListener('click', () => showEditor(currentText))
newButton.addEventListener('click', () => showEditor(''))

generateButton.addEventListener('click', async () => {
  try {
    const text = input.value
    if (!text) {
      setStatus('Enter some content first.')
      return
    }

    generateButton.disabled = true
    setStatus('Encoding…')
    const encoded = await encodePayload(text, algoSelect.value)
    const url = citationUrl(encoded.params)
    const humanUrl = new URL(`human/?${encoded.params}`, citationBaseUrl())

    history.replaceState(null, '', humanUrl)
    params.delete('q')
    params.delete('content')
    params.delete('algo')
    for (const [key, value] of encoded.params) params.set(key, value)
    showReader(text, encoded.algo)

    try {
      await copy(url, 'Citation')
    } catch {
      setStatus('Citation ready. Use “Copy citation” to copy it.')
    }
  } catch (error) {
    showError(error)
  } finally {
    generateButton.disabled = false
  }
})

input.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    generateButton.click()
  }
})
