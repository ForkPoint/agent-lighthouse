---
"@forkpoint/agent-lighthouse": patch
---

`--page-type` now reaches the scan. The flag was parsed and then dropped before `runScan`, so every page-typed audit ran as informative and a product scan silently lost 9.8 weight of score. The value is validated against the four page types at argument parsing; an unknown value exits with the valid list, the way an unknown category does. The flag is documented in `--help`.
