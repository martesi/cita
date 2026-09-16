# cita

Compact, self-contained references for LLM answers.

Cita keeps referenced text inside the URL itself. Nothing is stored in a database or object store.

## Pages

`/` only renders content from the URL. `/create/` creates Cita URLs.

Rendering defaults to literal text. Add `render=md` to render Markdown; embedded HTML stays disabled.

```text
/?q=<url-encoded-text>
/?algo=gzip&q=<base64url>
/?algo=br&q=<base64url>
/?q=<content>&render=md
```

GitHub Pages keeps the same static renderer and creator. Query-dependent decoding and Markdown rendering happen in the browser.

## MCP

The hosted backend exposes `/mcp` and `/api/mcp` and provides:

```text
create_reference(urls, base?, render?) -> results[]
```

Each result contains either `url` or `reason`. `base` overrides `CITA_BASE_URL`; hosted requests fall back to their request origin. `render: "md"` applies `render=md` to every generated URL.

The tool compares plain URL encoding and gzip, then considers Brotli for larger payloads and returns the shortest result. Generated URLs remain self-contained.

## Skill and local CLI

Reusable encoding and MCP logic lives under `skill/`. The hosted MCP imports the same implementation used by the local CLI.

```sh
bun skill/scripts/cli.ts encode 'content'
bun skill/scripts/cli.ts encode '# heading' --render md
bun skill/scripts/cli.ts mcp
```

`encode` also accepts content on stdin. `--base` or `CITA_BASE_URL` controls the target deployment.

## Development

```sh
bun install
bun run dev
bun run check
```

`bun run build` emits the static frontend under `dist/client` and the bundled MCP server entry under `dist/server`.

Because payloads live in query strings, they can appear in browser history, proxy/CDN request metadata, or server access logs. Cita removes persistent application storage; it is not encryption.
