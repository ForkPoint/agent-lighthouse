---
"@forkpoint/agent-lighthouse-core": patch
---

The live site corpus is curated. `sites.json` shrinks from 1913 blind entries to 414 categorised domains across 13 categories plus an unknown slice, with a smoke tier of two per category. A new `status.json` records what each domain did last time, and both live runners skip dead and robots-blocked domains by default. `pnpm corpus:status`, `pnpm corpus:probe` and `pnpm build:sites` maintain it. Scan output is unchanged; only test data and scripts move.
