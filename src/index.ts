const AGENT_PATTERN = /bot|crawler|spider|slurp|chatgpt|openai|gptbot|oai-searchbot|claudebot|anthropic|perplexity|googleother|bingpreview|facebookexternalhit|curl|wget/i

export default {
  fetch(request: Request): Response {
    const url = new URL(request.url)
    const userAgent = request.headers.get('user-agent') ?? ''

    if (AGENT_PATTERN.test(userAgent)) return agentResponse()

    const content = url.searchParams.get('q') ?? url.searchParams.get('content')
    return pageResponse(content)
  },
} satisfies ExportedHandler

function agentResponse(): Response {
  return htmlResponse(`
    <p class="eyebrow">Cita</p>
    <h1>Expanded reference</h1>
    <p>This citation contains auxiliary content intended for the reader. It is omitted here to keep the parent response concise. Follow the citation only when the expanded content is needed.</p>
  `)
}

function pageResponse(content: string | null): Response {
  if (!content) {
    return htmlResponse(`
      <p class="eyebrow">Cita</p>
      <h1>Nothing to display.</h1>
      <p>Pass text with <code>?q=...</code>.</p>
    `)
  }

  return htmlResponse(`<div class="content">${escapeHtml(content)}</div>`)
}

function htmlResponse(body: string): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Cita</title>
<style>
:root{color-scheme:light dark;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.6}body{margin:0;min-height:100vh;background:Canvas;color:CanvasText}main{width:min(44rem,calc(100% - 2rem));margin:0 auto;padding:12vh 0 4rem}.content{white-space:pre-wrap;overflow-wrap:anywhere;font-size:1.05rem}h1{margin:0 0 1rem;font-size:clamp(2rem,7vw,3.5rem);line-height:1.05;letter-spacing:-.04em}p{margin:0 0 1rem}.eyebrow{font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.14em;opacity:.55}code{font-family:ui-monospace,"SFMono-Regular",Consolas,monospace}
</style>
</head>
<body><main>${body}</main></body>
</html>`

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
    },
  })
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[character] ?? character
  })
}
