---
'@forkpoint/agent-lighthouse-core': major
'@forkpoint/agent-lighthouse': major
---

Audit boundary enforcement & gatherer uniformity (Phase 4 of audit architecture migration):
- Enforced architectural boundary: zero direct `ctx.fetch`, bare `fetch()`, or HTTP client imports in `packages/core/src/audits/`.
- Created AST contract script `scripts/check-audit-boundaries.mjs` and added `"check:audit-boundaries"` script to `package.json`.
- Created dedicated gatherer modules `gatherers/mcp.ts`, `gatherers/discovery.ts`, `gatherers/rsl.ts`, `gatherers/security.ts`, and `gatherers/author.ts` with WeakMap per-scan fetch caching.
- Moved `_mcp-client.ts` out of `audits/` into `gatherers/mcp.ts`.
- Refactored all 235 production audits across 8 categories to consume gatherers exclusively.
- Updated `scripts/lib/requires-analysis.mjs` with gatherer evidence mappings.
