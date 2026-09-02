---
"@forkpoint/agent-lighthouse-core": patch
---

Moved corpus analysis script from test suite to `scripts/analyze-corpus.ts`:

- Migrated `packages/core/src/tests/analyze-corpus.test.ts` to `scripts/analyze-corpus.ts`.
- Eliminates CI `ENOENT` failure caused by the test attempting to write an analysis report to a local workstation artifact path.
- Removes 75 seconds of redundant corpus re-execution from vitest test runs while preserving on-demand corpus diagnostic reporting via `pnpm exec tsx scripts/analyze-corpus.ts`.
