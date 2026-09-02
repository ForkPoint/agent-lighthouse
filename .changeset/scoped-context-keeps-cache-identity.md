---
"@forkpoint/agent-lighthouse-core": patch
---

Gatherer caches survive audit scoping. The runner hands every audit a scoped copy of the scan context, and the sixteen per-scan gatherer caches were keyed on that copy, so each audit missed the cache and repeated its fetch: three quarters of a scan's audit-time requests were duplicates. The copy now carries a `cacheOwner` stamp pointing at the scan's context, and every gatherer keys on it. One scan, one walk of the sitemap tree, one probe per feed.
