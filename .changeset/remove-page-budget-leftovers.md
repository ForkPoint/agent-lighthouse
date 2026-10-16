---
"@forkpoint/agent-lighthouse-core": major
---

Remove leftovers of the multi-page scan that nothing read. A scan reads one target URL, plus declared `pages` and at most one gateway target; the page budget was never configurable after the single-URL scan unit.

- `MAX_PAGES_PER_SCAN` and `DEFAULT_SCAN_LIMIT` are no longer exported from the core package.
- The `maxPages` key is removed from `AgentLighthouseConfig` and `PresetOptions`. A JSON config file that still sets `maxPages` loads as before and the key stays ignored; TypeScript code that passes `maxPages` to `defineConfig` no longer type-checks. Remove the key.
- The docs, the website MCP page and the MCP tool's `pages` description state the real page set instead of a six-page budget and page discovery.
