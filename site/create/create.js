import { compressionAvailable, encodePayload } from '../codec.js'

const input = document.querySelector('#input')
const algoSelect = document.querySelector('#algo')
const renderSelect = document.querySelector('#render')
const generateButton = document.querySelector('#generate')
const status = document.querySelector('#status')

if (!compressionAvailable()) algoSelect.querySelector('option[value="gzip"]').disabled = true

function setStatus(message) {
  status.textContent = message
}

function showError(error) {
  setStatus(error instanceof Error ? error.message : String(error))
}

function citationBaseUrl() {
  return new URL('../', location.href)
}

async function generate() {
  const text = input.value
  if (!text) {
    setStatus('Enter some content first.')
    return
  }

  generateButton.disabled = true
  setStatus('Encoding…')

  try {
    const encoded = await encodePayload(text, algoSelect.value)
    if (renderSelect.value) encoded.params.set('render', renderSelect.value)
    const url = citationBaseUrl()
    url.search = encoded.params.toString()
    await navigator.clipboard.writeText(url.toString())
    setStatus('Citation copied.')
  } catch (error) {
    showError(error)
  } finally {
    generateButton.disabled = false
  }
}

generateButton.addEventListener('click', generate)
input.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    generate()
  }
})
