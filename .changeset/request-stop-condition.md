---
"@forkpoint/agent-lighthouse-core": minor
"@forkpoint/agent-lighthouse-report": minor
---

Report a request-scheduler stop during a scan. When a site answers HTTP 429, a 403 to the scanner, or two 503s in a row, the scanner stops sending it requests. The report now states this under `conditions.requestStop`: `stopped`, `reason`, `unsentCount`, `affectedAuditCount` and `affectedMass`. Each affected audit lists the held-back URLs under `coverage.unsentUrls`. The Markdown and HTML reports print one line when the stop cost requests. The score does not change.

`HostStopReason` now lives with the report contracts and is still exported from the package root.
