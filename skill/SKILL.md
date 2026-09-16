---
name: cita
description: Create compact, self-contained Cita reference URLs locally. Use when text or source URLs should be encoded into Cita links, optionally rendered as Markdown, or when a local stdio MCP server exposing Cita's create_reference tool is needed.
---

# Cita

Use `scripts/cli.ts` as the single local entry point.

## Encode content

Run:

```sh
bun scripts/cli.ts encode '<content>' [--base https://cita.example] [--render md]
```

If content is omitted, pipe it on stdin. `CITA_BASE_URL` supplies the default base URL when set.

## Serve MCP locally

Run:

```sh
bun scripts/cli.ts mcp
```

The `create_reference` tool accepts `urls`, optional `base`, and optional `render: "md"`. The render option applies to every generated URL.
