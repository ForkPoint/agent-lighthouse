---
"@forkpoint/agent-lighthouse-core": patch
---

`ScanOptions` fields and `FetchOptions.signal` now accept an explicit `undefined`, which means the same as leaving the option out. Callers compiled with `exactOptionalPropertyTypes` can forward optional values without spreading them conditionally. No runtime behaviour changes.
