---
"@forkpoint/agent-lighthouse-core": minor
"@forkpoint/agent-lighthouse": minor
"@forkpoint/agent-lighthouse-mcp": minor
---

Add structured scan progress events:
- Core: typed `ScanEvent` stream via `runScan(url, { onEvent })` — phase/unit events with computed monotonic `fraction` and `elapsedMs`, per-audit progress, and `unit:fail` visibility for errored audits
- CLI: interactive progress renderer (spinner, progress bar, ETA, per-phase summary lines) and `--progress-json` NDJSON event stream on stderr
- MCP: `notifications/progress` forwarded when the request carries a `progressToken`

Deprecated: the positional `runScan(url, onProgress, pageOverrides, signal)` callback form — use `runScan(url, { onEvent, pages, signal })`. The legacy form still works (with a one-time warning) and will be removed in the next major release.
