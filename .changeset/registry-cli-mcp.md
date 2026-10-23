---
"@forkpoint/agent-lighthouse": minor
"@forkpoint/agent-lighthouse-mcp": minor
---

Add `agent-lighthouse --registry`, which prints what the installed version checks: the core version, the number of audits and categories, the count per tier and the registry mass, overall and per category. `--registry --json` prints the `getRegistrySummary()` object. The MCP server gains a `registry_summary` tool with the same JSON. Neither runs a scan. The bundled skill now asks an agent to read the count from the tool rather than quote one.
