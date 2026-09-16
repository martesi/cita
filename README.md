# cita

Compact, self-contained references for LLM answers.

Cita keeps referenced text inside the URL itself. Nothing is stored in a database or object store.

Deployments:
- `https://martesi.github.io/cita/` — static GitHub Pages deployment; transparent and reproducible from the repository.
- `https://cita.martes.dev` — ChatGPT-hosted deployment; manually deployed and platform-controlled. Its usable MCP endpoint is `/api/mcp` because ChatGPT Sites does not currently permit `/mcp`.

## Pages

`/` only renders content from the URL. `/create/` creates Cita URLs.

Rendering defaults to literal text. Add `render=md` to render Markdown; embedded HTML stays disabled.

```text
/?q=<url-encoded-text>
/?algo=gzip&q=<base64url>
/?algo=br&q=<base64url>
/?q=<content>&render=md
```

## MCP

When deployed on a normal host, the backend exposes both `/mcp` and `/api/mcp`. The duplicate `/api/mcp` path exists for ChatGPT Sites, which does not currently permit clients to use `/mcp`; on that deployment, clients should use `/api/mcp`.

```text
create_reference(urls, base?, render?) -> results[]
```

Each result contains either `url` or `reason`. `base` overrides `CITA_BASE_URL`; hosted requests fall back to their request origin. `render: "md"` applies `render=md` to every generated URL.

The tool compares plain URL encoding and gzip, then considers Brotli for larger payloads and returns the shortest result. Generated URLs remain self-contained.

## Skill and local CLI

Reusable encoding logic lives under `skill/`. The hosted MCP imports the same core implementation used by the local CLI.

```sh
node --experimental-strip-types skill/scripts/cli.ts encode 'content'
node --experimental-strip-types skill/scripts/cli.ts encode '# heading' --render md
```

`encode` also accepts content on stdin. `--base` or `CITA_BASE_URL` controls the target deployment.

## Development

```sh
bun install
bun run dev
bun run check
```

`bun run build` emits the static frontend under `dist/client` and the bundled MCP server entry under `dist/server`.

Because payloads live in query strings, they can appear in browser history, proxy/CDN request metadata, or server access logs.
