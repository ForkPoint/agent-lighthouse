---
"@forkpoint/agent-lighthouse-core": minor
"@forkpoint/agent-lighthouse": minor
---

Structured logging. Every log line now carries a time, a level, the site, a short scan id and the component that wrote it, so lines from scans that run side by side can be told apart. Components are fields, not prefixes in the message: `[fetcher] Fetch error: <url> - <error>` is now `fetcher: Request failed url=<url> error=<error>` in text, or `"component":"fetcher"` in JSON. Logs go to stderr only; before, debug and info lines went to stdout, where they could corrupt a report or the MCP stream.

- New CLI flags: `--log-level <level>` sets the terminal level, and `--log-file <path>` appends every line, at debug level, as JSON lines.
- `LOG_FORMAT=json` writes JSON lines to stderr. An unknown `LOG_LEVEL` now warns and falls back to `info` instead of turning on every level.
- New debug lines: scan start and end, time per phase, each request when it starts and ends, a detected bot wall, a host the scan stopped calling, root files not sent, and UA probes skipped. A scan that ends with requests still open names them at warn level.
- Core exports `logger.child()`, `withLogContext`, `LogFormat`, `formatLogRecord`, `parseLogLevel`, `parseLogFormat`, `logger.addSink()` and `logger.enabled()`. `logger.debug|info|warn|error` accept `(message, fields)` as well as the older `(fields, message)`.
- A debug line no longer prints the scan URL with its credentials.
