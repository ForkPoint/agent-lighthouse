---
"@forkpoint/agent-lighthouse-core": minor
---

Add a default request scheduler, a capture hook and replay mode.

- `createRequestScheduler(options)` keeps one queue per host and stops a host on HTTP 429, on a 403 to the scanner's own User-Agent or the browser baseline, and on two 503s in a row. A `Retry-After` longer than `maxRetryAfterMs` stops the host instead of waiting. `exportState`, `importState` and `onChange` let a caller keep host stops and cooldowns across runs.
- The fetcher now reports a 403 to the browser baseline User-Agent as the scanner's own (`ownAgent: true`). A scheduler stops such a host instead of continuing to request it.
- `onExchange` on `createFetcher` and `runScan` records each request sent, redirect hops included, with the response bytes the fetcher read.
- `createReplay(exchanges)` and the new `fetcher`, `lookup` and `now` scan options re-run a scan from its captures with no network access. Probe names and tokens now derive from `scanId`, and audit date comparisons, `scannedAt`, `durationMs` and the origin read time use the scan clock.
- New exports: `createRequestScheduler`, `HostStoppedError`, `HostStopReason`, `schedulerHostKey`, `createReplay`, `withScanEnvironment`, `scanNow`, `buildOfflineContext`, `parsePageContext`, `pageRendersText`, `extractMicrodata`, `extractRdfa`, and the `Fetcher`, `FetcherSummary`, `HttpExchange`, `HostState` and related types.
