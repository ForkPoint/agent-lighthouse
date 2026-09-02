---
"@forkpoint/agent-lighthouse-core": patch
---

Refactor audit source extraction to eliminate code duplication across contract tests and CI scripts:
- Exported canonical `auditSourceFiles` and `declaredIds` helpers from `packages/core/src/tests/audit-sources.ts`.
- Migrated `scripts/lib/requires-analysis.mjs` and `scripts/check-requires.mjs` to fully-typed TypeScript (`.ts`) consuming `audit-sources.ts`.
- Eliminated 15 lines of duplicated filesystem traversal and regex extraction code.
- Updated `docs/architecture/debt.md` closing the audit-sources reflection debt item.
