---
name: cita
description: Create compact, self-contained Cita reference URLs from text or source URLs, optionally rendered as Markdown. Prefer an available Cita MCP create_reference tool from the current tool context; otherwise fall back to the bundled local encoder CLI.
---

# Cita

Prefer an already-exposed Cita MCP tool when the current tool context provides one. Use its `create_reference` operation directly.

If no Cita MCP tool is available, run the bundled CLI:

```sh
node --experimental-strip-types scripts/cli.ts encode '<content>' [--base https://cita.example] [--render md]
```

If content is omitted, pipe it on stdin. `CITA_BASE_URL` supplies the default base URL when set.
