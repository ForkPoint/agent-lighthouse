---
'@forkpoint/agent-lighthouse-core': major
---

Every audit now receives the scan's evidence record.

`CheckContext` gains a required `evidence` field, built once per scan before
any audit runs. It records whether the origin answered, whether anything
blocked the scan, which fetched pages served readable text, and which page
types are usable. Nothing is gated on it yet — audits that want it can read it.

The field is required rather than optional on purpose: an optional field fails
open, and a caller that forgets it is exactly the silent-nothing verdict the
record exists to remove. Code that builds a `CheckContext` by hand must pass
one; `allEvidenceMet()` is exported for callers that do not exercise the gate.
