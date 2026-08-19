---
"@forkpoint/agent-lighthouse-core": minor
"@forkpoint/agent-lighthouse": minor
"@forkpoint/agent-lighthouse-mcp": minor
---

Add structured scan progress events:
- Core: typed `ScanEvent` stream via `runScan(url, { onEvent })` — phase/unit events with computed monotonic `fraction` and `elapsedMs`, per-audit progress, and `unit:fail` visibility for errored audits
- CLI: interactive progress renderer (spinner, progress bar, ETA, per-phase summary lines) and `--progress-json` NDJSON event stream on stderr
- MCP: `notifications/progress` forwarded when the request carries a `progressToken`

Deprecated: the positional `runScan(url, onProgress, pageOverrides, signal)` callback form — use `runScan(url, { onEvent, pages, signal })`. The legacy form still works (with a one-time warning) and will be removed in the next major release. Note for anyone snapshotting legacy CLI output: mapped percentages now start at 0 and are derived from phase weights, so they land a few points earlier than the old hardcoded values.

`runAudits(ctx, config, onProgress)` keeps supporting the legacy `(completed, total)` callback (now deprecated, fired per settled audit instead of per batch); prefer the new `(event: AuditProgressEvent) => void` form. An optional precomputed `AuditPlan` from `planAudits` can be passed as a fourth argument.
