export default {
  fetch(request: Request): Response {
    const url = new URL(request.url)

    if (url.pathname === '/llms.txt') return llmsResponse()
    if (url.pathname === '/human') return humanResponse(url)
    if (url.pathname === '/') return citationResponse()

    return new Response('Not found', { status: 404 })
  },
} satisfies ExportedHandler

function citationResponse(): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Cita</title></head><body><p>Cita is working. New here? Read <a href="/llms.txt">llms.txt</a>. Need the payload? Open <code>/human</code>.</p><script>location.replace('/human'+location.search+location.hash)</script></body></html>`,
    {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=3600',
        'x-robots-tag': 'noindex',
      },
    },
  )
}

function humanResponse(url: URL): Response {
  const content = url.searchParams.get('q') ?? url.searchParams.get('content')

  if (!content) {
    return htmlResponse(`
      <p class="eyebrow">Cita</p>
      <h1>Nothing to display.</h1>
      <p>Pass text with <code>?q=...</code>.</p>
    `)
  }

  return htmlResponse(`<div class="content">${escapeHtml(content)}</div>`)
}

function llmsResponse(): Response {
  return new Response(
    [
      '# Cita',
      '',
      'Cita creates compact citation URLs whose query payload is intended for a human reader.',
      'The root URL intentionally does not expose the payload in its HTML response.',
      'A normal browser redirects from / to /human and displays the query content there.',
      'Agents should normally cite the root URL without fetching /human.',
      'Use /human with the same query string only when you need to verify or inspect the generated content.',
    ].join('\n'),
    {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'public, max-age=3600',
        'x-robots-tag': 'noindex',
      },
    },
  )
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
