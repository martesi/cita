# cita

Compact, self-contained references for LLM answers.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/martesi/cita)

Cita keeps the referenced text inside the URL itself. Nothing is stored in a database or object store.

## MCP

A Cloudflare deployment exposes:

```text
https://<your-worker>/mcp
```

It provides one tool:

```text
create_reference(content) -> self-contained citation URL
```

The tool automatically compares plain URL encoding and gzip, then considers Brotli for larger payloads:

```text
/?q=<url-encoded-text>
/?algo=gzip&q=<base64url>
/?algo=br&q=<base64url>
```

It returns the shortest result. This lets an LLM create compressed links without needing its own compression or Base64 implementation. Browsers try native Brotli first; the Brotli WASM module is lazy-loaded only when Brotli is actually needed and the native format is unavailable. Ordinary plain/gzip links do not download it.

The resulting URL is self-contained: another Cita deployment using the same static frontend can decode it without access to the MCP server that created it.

## How citation pages behave

The initial citation page intentionally does not put the payload into its HTML body, so an agent fetching it only sees a small notice. JavaScript-capable browsers preserve the query and redirect to `human/`, where the content is decoded and displayed.

Because the payload is in the query string, it can still appear in ordinary browser history, proxy/CDN request metadata, or server access logs. Cita removes persistent application storage; it is not an encryption or secrecy mechanism.

## Development

```sh
bun install
bun run dev
```

`bun run dev` serves `site/` with Vite HMR.

For the MCP Worker:

```sh
bun run dev:worker
```

Checks:

```sh
bun run check
```

Deploy the stateless MCP + static site to Cloudflare:

```sh
bun run deploy
```

## GitHub Pages

GitHub Pages remains the zero-backend option. Enable Pages with **GitHub Actions** as the source, then run the `Deploy Pages` workflow.

Pages builds `site/` with Vite and publishes `dist/`. It supports creating and reading the same self-contained `q=` / `algo=gzip` / `algo=br` URLs in the browser, but it does not provide `/mcp`.
