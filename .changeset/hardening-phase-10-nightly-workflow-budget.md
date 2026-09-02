---
"agent-lighthouse-monorepo": patch
---

Hardened corpus nightly scan workflow and site-list runner:
- Sized nightly site scan window to 200 sites per run to fit comfortably within the 240-minute deadline.
- Added `--allow-partial` flag to `scripts/scan-site-list.ts` and enabled it in `.github/workflows/corpus-nightly.yml`, separating timeout capacity from invariant violations so partial runs complete with code 0 and preserve their uploaded summaries.
