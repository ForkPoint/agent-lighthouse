---
"@forkpoint/agent-lighthouse-core": minor
"@forkpoint/agent-lighthouse": minor
"@forkpoint/agent-lighthouse-report": minor
---

A scan now runs under a wall-clock budget. `SCAN_TIMEOUT_MS` was declared and never read; the only bound was the 10 s per request, so a slow origin that answered every request stretched a scan without end (twilio.com: 1054 s). The constant is now read, and its exported value moves from 60 000 to 180 000: 180 s clears the 95th percentile of the curated corpus with margin, where 60 s would have cut one site in five.

- `runScan` accepts `timeoutMs`; the default is `SCAN_TIMEOUT_MS`, and `0` disables the budget. A negative or NaN value throws a `RangeError`. When the budget runs out the scan finishes with what it has: requests in flight abort, no further request is sent, and every audit not yet started, or still running, reports `na` tagged `skipped:scan-budget` with an explanation that names the budget. A running audit is withheld rather than believed, because a request the budget refused reads to an audit as a broken link or a missing artifact. The caller's own `signal` still ends the scan with a throw, including during a 429 retry wait.
- `conditions.budget` on the report records `limitMs`, `elapsedMs`, `exhausted` and `skippedCount`. If the budget's cut, together with what the evidence gate removed, leaves more than 35% of the registry's evidence mass unassessed, the scan reports no score and `unscoredReason` says why. A scan of a slow origin that used to return a score after many minutes may therefore now return `overallScore: null` at 180 s; raise the budget to keep the old behaviour.
- The audit trace gains the outcome `budget`.
- The CLI gains `--timeout <seconds>` (config file key `timeout`, also on `AgentLighthouseConfig`) and prints one line when the budget ran out. A bare flag, a negative or non-numeric value, from the flag or the file, is refused. The HTML and Markdown reports show the budget beside the other scan conditions.
