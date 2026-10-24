---
"@forkpoint/agent-lighthouse-core": patch
---

Preserve scan-level headers when using a supplied fetcher, including replay. Per-request headers keep case-insensitive precedence, and replay still requires an exact request match.

Keep warm-cache scans running when the capture callback throws while receiving cached origin exchanges. Log the capture failure without changing the site's results.
