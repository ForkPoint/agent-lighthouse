---
"@forkpoint/agent-lighthouse-core": patch
"@forkpoint/agent-lighthouse-mcp": patch
---

Raise minimum runtime dependency versions: `undici` ^8.12.3 and `gpt-tokenizer` ^4.1.0 in core, `@modelcontextprotocol/sdk` ^1.32.2 in mcp. The workspace also pins the transitive `undici` 7.x (via cheerio) to 7.30.1 and `fast-uri` (via ajv) to 3.1.9, which clears seven advisories (GHSA-xjj6-f33q-929c, GHSA-4qv8-2p9j-2685, GHSA-f72v-6w45-q472, GHSA-w74x-v6f9-j3xg, GHSA-wjr9-j795-jxcr, GHSA-xhq7-xmqj-769h, GHSA-333x-w4r6-6crp) in development and CI installs. Installs of the published packages already resolve those patched versions through the existing semver ranges.
