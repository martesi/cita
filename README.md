# cita

Compact references for LLM answers.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/martesi/cita)

The deploy flow clones the repository into your GitHub or GitLab account, asks you to authorize Cloudflare, provisions the required D1 database, applies the included migration, deploys the Worker, and connects future pushes to Workers Builds.

## MCP

Connect an MCP client to:

```text
https://<your-worker>/mcp
```

Cita exposes one tool:

```text
create_reference(content, ttl_seconds?) -> short citation URL
```

The returned URL looks like:

```text
https://<your-worker>/r/AbCdEf012345
```

The citation page is intentionally tiny and does not include the stored content. A browser redirects to `/r/<id>/human`; agents normally do not need to follow that route.

References default to 7 days, accept a maximum TTL of 30 days, and accept up to 256 KiB of UTF-8 text.

## Development

Install dependencies:

```sh
bun install
```

Fast UI-only development with Vite HMR:

```sh
bun run dev
```

Full Worker + local D1 + MCP development:

```sh
bun run dev:worker
```

Wrangler applies the local D1 migration, then watches the Worker and static assets. Local D1 data is isolated from production.

Check the Worker bundle and TypeScript:

```sh
bun run check
```

## HTTP API

The MCP tool and HTTP API share the same storage path. This is useful for simple integrations and local testing:

```http
POST /api/references
Content-Type: application/json

{
  "content": "Auxiliary text",
  "ttl_seconds": 604800
}
```

## URL-embedded references

The earlier no-storage format remains supported:

```text
/?q=<url-encoded-text>
/?algo=gzip&q=<base64url>
```

For larger LLM-generated content, prefer `create_reference` so the citation URL stays short.

## GitHub Pages

GitHub Pages remains available as a static-only deployment option. Enable Pages with **GitHub Actions** as the source, then run the `Deploy Pages` workflow manually.

Pages publishes `site/` directly and supports the URL-embedded `q=` / `algo=gzip` references and the browser UI. Stored `/r/<id>` references and `/mcp` require the Cloudflare Worker deployment.

## Access

The default template exposes `create_reference` publicly so a newly deployed MCP endpoint works without a second identity-provider setup. Put the Worker behind Cloudflare Access or another OAuth layer before using it where anonymous writes are unacceptable.
