---
"@forkpoint/agent-lighthouse-core": minor
---

Hardened CSS selector escaping in parser and operability audits, and added true offline safety for `isSafeUrl` under `AL_SKIP_NETWORK=1`:
- Exported and applied `escapeAttrValue` to prevent Cheerio syntax crashes when HTML attributes (such as form element IDs, `aria-controls`, `aria-describedby`, and `aria-labelledby`) contain quotes or backslashes.
- Bypassed live `dns.lookup` in `isSafeUrl` when `AL_SKIP_NETWORK=1` while preserving local and private IP validation, ensuring reproducible offline test runs.
- Resolved documented architectural debt items 1 (OpenAPI absence), 4 (selector escaping), and 9 (offline DNS safety) in `docs/architecture/debt.md`.
