---
"@forkpoint/agent-lighthouse-core": major
"@forkpoint/agent-lighthouse": major
---

One URL, One Score, The Origin Cached (Phase 5 of audit architecture migration):

- Fixed `MAX_PAGES_PER_SCAN = 1` and `DEFAULT_SCAN_LIMIT = 1`, removing legacy multi-page discovery heuristics and regex guessers.
- Scans now evaluate the exact target URL as the single page unit while preserving explicit page overrides (`options.pages`).
- Introduced `OriginCache` module (`computeOriginCacheKey`, `shouldBypassOriginCache`, TTL eviction, and credential stripping) with versioned cache keys (`${origin}|${ORIGIN_EVIDENCE_VERSION}`).
- Scans on the same origin reuse cached origin evidence (root files and homepage), making multi-page evaluations fast, isolated, and idempotent.
- Authenticated scans (`Authorization`, `Cookie`, or basic-auth credentials) automatically bypass the shared origin cache to guarantee secret isolation.
- Stamped `originEvidence` metadata (`origin`, `version`, `readAt`, `cached`) into `ScanReport`.
- Added comprehensive unit tests in `packages/core/src/tests/origin-idempotence.test.ts` verifying all three Phase 5 gates: Idempotence across URLs, Cache Isolation & Credential Protection, and Version Invalidation.
