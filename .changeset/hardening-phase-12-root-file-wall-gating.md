---
"@forkpoint/agent-lighthouse-core": minor
---

Scoped all root-file audits to require `unblocked-fetches`:
- Updated `ORIGIN_ONLY_REQUIRES` in `scripts/lib/requires-analysis.mjs` to require `unblocked-fetches`, removing the blanket category drop in `access-crawl-control`.
- Updated all 65 root-file and crawler-token audits across `access-crawl-control`, `agent-interfaces`, `machine-discovery`, and `operability-safety` to declare `unblocked-fetches`.
- Guarantees that when a site is blocked by a bot wall or WAF at HTTP 200, all root-file audits gracefully decline with `notApplicable` rather than emitting false failure or warning verdicts.
- Fixed emphasis regex in `dossier-public.test.ts` for Prettier formatting resilience.
