---
"@forkpoint/agent-lighthouse-core": patch
---

Origin evidence is delivered and cached in one order. The origin homepage a non-homepage scan fetched never reached the audits, and a homepage scan wrote `undefined` into the origin cache before repairing it, so whether a later scan of the origin saw a homepage depended on which URL was scanned first. The cache is now written after the page fetch, and `CheckContext.originEvidence` carries the origin, version, read time, cache status and homepage.
