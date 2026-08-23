---
"@forkpoint/agent-lighthouse-core": patch
---

Fixes two unbounded loops in the provenance path, both reachable from ordinary
site-controlled image bytes.

`riffChunks` read a WebP chunk size with `<< 24`, which returns a negative
number once the high bit is set. A negative length walked the cursor backwards
and the loop never terminated, so one malformed or hostile WebP hung the scan
indefinitely. The size is now read as an unsigned 32-bit value.

`certificatesIn` tried a DER parse at every offset that looked like a
certificate header. A blob of repeated `30 82` bytes bought one parse attempt
per byte — 2 s of CPU per megabyte, up to six images per scan. Attempts are now
capped at 256, well above the 2–4 certificates a real chain carries.
