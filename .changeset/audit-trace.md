---
"@forkpoint/agent-lighthouse-core": minor
"@forkpoint/agent-lighthouse": minor
---

A scan can now emit one record per audit, so a verdict can be traced back to
the evidence it came from.

A report says what each audit concluded. It does not say which audits never ran
and why, how long each took, or what a verdict was drawn from — and an audit
that produced nothing looks the same in a report as one that considered the
question and answered "not applicable".

`--trace [path]` writes one NDJSON record per registered audit, including the
ones skipped before running and the ones that errored. Each record carries the
outcome (`ran`, `skipped`, `error`), the status, score, weight, tier and grade,
the wall time inside `audit()`, and the structured evidence behind the verdict.
The file is truncated at the start of a scan and appended to as it runs, so a
crash still leaves everything up to the point it stopped. Two runs produce two
comparable files.

Programmatically, `runScan` takes an `onAuditTrace` handler that receives the
same records. With neither, `LOG_LEVEL=debug` logs one line per audit; with
none of the three, nothing is built.
