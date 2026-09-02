---
"@forkpoint/agent-lighthouse-core": patch
---

Request header layers merge by case-insensitive name. A caller's `user-agent` or `authorization` in another casing was sent beside the scanner's own header as one joined value; it is now replaced. `mergeHeaders` and `setHeader` are exported from the fetcher.
