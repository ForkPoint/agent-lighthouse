---
"@forkpoint/agent-lighthouse-core": minor
---

Add opt-in ready-host request admission with atomic global, per-fetcher and host limits. Expose separate queue-wait diagnostics while preserving HTTP timing, refusal policy and legacy fetcher admission. Queue-wait fields appear only on a fetcher with a scheduler. A stopped host rejects ready waiters at once; a plain `acquire` waiter still learns of the stop once the host's requests in flight end.
