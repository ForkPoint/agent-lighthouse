---
"@forkpoint/agent-lighthouse-core": minor
"@forkpoint/agent-lighthouse": minor
---

Structured logging.

- Every line carries a time, a level, a message and fields: the site, the scan id and the component that wrote it. Components are fields from child loggers, not prefixes in the message.
- `runScan` takes a `logger` option. Any logger with pino's methods works, pino included, and every line of that scan goes to it. Calls use pino's order, `log.info({ fields }, "Message")`.
- `runScan` takes a `scanId` option and now fills the report's `scanId`, which was always empty. Omitted, it is a random UUID. Log lines carry the same id, so a log and its report join on it.
- New `trace` level below `debug`. Levels: `error` for scanner faults (with the stack), `warn` for what changes a result, `info` for one line per scan, `debug` for decisions and phases, `trace` for each request and audit.
- Field names follow OpenTelemetry where it has one (`http.request.method`, `url.full`, `http.response.status_code`, `user_agent.original`); durations are `durationMs`; errors are `err` with `type`, `message`, `stack`, `code` and `cause`.
- The logger removes credentials before it writes: a URL's `user:password@` anywhere in a line, and the value of keys named like a secret (`authorization`, `cookie`, `token` and similar). The old debug line that printed the scan URL with its credentials is gone.
- Logs go to stderr only; before, debug and info lines went to stdout.
- A failed request is now a debug line. The scan logs one warning that counts the failures by error code, and one when requests are still open after the audits.
- New CLI flags: `--log-level <level>` sets the terminal level (default `warn`), and `--log-file <path>` appends every line as JSON. `LOG_FORMAT=json` writes JSON to stderr. An unknown `LOG_LEVEL` now warns and falls back to `info` instead of turning on every level.
- Core exports `LogField`, `LoggerLike`, `withLogContext`, `LogFormat`, `formatLogRecord`, `parseLogLevel`, `parseLogFormat`, `logger.child()`, `logger.addSink()` and `logger.isLevelEnabled()`.
