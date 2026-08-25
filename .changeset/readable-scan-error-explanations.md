---
"@forkpoint/agent-lighthouse-core": patch
---

A `scan-error` now says which field failed instead of pasting the whole
validation tree.

When an audit's result is rejected by `AuditResultSchema`, the runner records
it as a `scan-error` stub whose explanation carried `err.message`. For a Zod
rejection that is the entire issue tree — several hundred lines of JSON for one
bad field, written into every report the scan produces. The explanation now
names at most three field paths and their reasons
(`details.ghosts: Expected string, received object`), and any other long
message is truncated rather than pasted whole.
