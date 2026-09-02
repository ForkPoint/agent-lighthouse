---
"@forkpoint/agent-lighthouse-core": patch
---

Follow redirects in `machine-discovery/no-broken-links` so HTTP 3xx responses are not treated as broken, and guard `displayValue` and `explanation` against schema overflow in `Audit.toCheckResult`.
