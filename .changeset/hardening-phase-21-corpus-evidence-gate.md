---
"@forkpoint/agent-lighthouse-core": patch
---

Add corpus evidence gate test suite (`packages/core/src/tests/corpus-evidence-gate.test.ts`):

- Exercises `buildScanEvidence()` and `planAudits()` over all 41 real-page fixtures in the corpus.
- Proves real bot walls are classified as unjudgeable and run zero page-fed audits.
- Proves real JavaScript shells gate `rendered-body` and skip text-reading audits.
- Proves real content pages clear all evidence gates and plan runnable audits.
- Closes the final standing debt item in `docs/architecture/debt.md`.
