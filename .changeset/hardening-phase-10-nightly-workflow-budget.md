---
"@forkpoint/agent-lighthouse-core": patch
---

Hardened corpus nightly scan workflow and site-list runner:

- Sized the nightly site scan window against the 240-minute deadline (200 sites per run at the time; the curated list later made the window the whole list).
- Added `--allow-partial` flag to `scripts/scan-site-list.ts` and enabled it in `.github/workflows/corpus-nightly.yml`, separating timeout capacity from invariant violations so partial runs complete with code 0 and preserve their uploaded summaries.
