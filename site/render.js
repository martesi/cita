import { decodePayload, utf8ByteLength } from './codec.js'

const params = new URLSearchParams(location.search)
const reader = document.querySelector('#reader')
const content = document.querySelector('#content')
const meta = document.querySelector('#meta')
const status = document.querySelector('#status')
const copyTextButton = document.querySelector('#copy-text')
const copyLinkButton = document.querySelector('#copy-link')

let currentText = ''

init().catch(showError)

async function init() {
  const payload = params.get('q') ?? params.get('content')
  if (!payload) {
    setStatus('No content to render.')
    return
  }

  currentText = await decodePayload(params)
  await renderContent(currentText, params.get('render'))
  reader.hidden = false
  meta.textContent = `${formatBytes(utf8ByteLength(currentText))} · ${params.get('algo') || 'plain'}`
}

async function renderContent(text, mode) {
  content.classList.toggle('markdown', mode === 'md')

  if (mode === 'md') {
    const { default: MarkdownIt } = await import('markdown-it')
    const markdown = new MarkdownIt({ html: false, linkify: true, breaks: false })
    content.innerHTML = markdown.render(text)
    content.querySelectorAll('a[href]').forEach((link) => {
      const url = new URL(link.getAttribute('href'), location.href)
      if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) link.removeAttribute('href')
    })
    return
  }

  content.textContent = text
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
}

function setStatus(message) {
  status.textContent = message
}

function showError(error) {
  setStatus(error instanceof Error ? error.message : String(error))
}

async function copy(value, label) {
  await navigator.clipboard.writeText(value)
  setStatus(`${label} copied.`)
}

copyTextButton.addEventListener('click', () => {
  copy(currentText, 'Text').catch(showError)
})

copyLinkButton.addEventListener('click', () => {
  copy(location.href, 'Citation').catch(showError)
})
