---
"@forkpoint/agent-lighthouse-core": patch
---

Resolve architecture debt item 1: accessibility audits on real-page corpus:
- Added dedicated conformance test suite `packages/core/src/tests/a11y-corpus.test.ts`.
- Exercises all 17 `A11yBackedAudit`s over representative real-world HTML documents across public sector, public health, forum, storefront, and SPA shell pages in ~3.2 s.
- Proves schema compliance, node target findings on failures, and valid transitions between pass, fail, warn, and na states on real DOMs without inflating the 120 s runtime cap of `real-page-corpus.test.ts`.
- Updated `docs/architecture/debt.md` closing debt item 1.
