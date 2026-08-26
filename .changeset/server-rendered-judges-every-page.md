---
'@forkpoint/agent-lighthouse-core': major
---

`content-extraction/server-rendered` now judges every fetched page, not just
the first.

The audit reads the per-page record the scan already built and reports a ratio:
pass when every page served readable text, warn when some did not (the empty
URLs are listed in `details.emptyPages`), fail at critical priority when none
did. Its `message` and `found` strings changed shape accordingly.

A scan that fetched no page reports `notApplicable` instead of `warn`. Warning
was a claim about the site; the truth is that nothing was seen.
