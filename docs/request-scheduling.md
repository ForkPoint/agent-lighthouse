# Ready-host request scheduling

`createRequestScheduler({ maxConcurrent: 32 })` limits active requests across fetchers. Enable `readyRequestScheduling: true` on `createFetcher` or `runScan` to admit ready hosts before consuming a fetcher's `maxConcurrent` allowance. The default scheduler supports this additive API. Custom schedulers must implement `acquireRequest(url, { owner, maxConcurrent }, signal)` to opt in. Each fetcher supplies one stable owner object. An owner's limit must remain constant. Limits must be positive safe integers. A supplied fetcher must configure its own admission; `runScan` rejects this option alongside a supplied fetcher.

The scheduler holds one lease per normalized host through response-body completion. Apex and www share that lease. Pending work holds no execution capacity. Shared-host queues rotate owner turns and retain each owner's FIFO order. Cancellation removes only its pending entry. Release is idempotent. Imports and response-policy changes recheck the frontier.

The implementation rebuilds a bounded frontier on queue, capacity or state changes. It sorts at most one entry per known host by readiness and fair host turn. Each pass admits at most one request per host, so hosts take turns. Passes repeat until one admits nothing, so a host with several free slots fills them all when its gap ends. Each pass costs O(H log H), plus O(Q) queue selection for queued work. It keeps one wake timer rather than one timer per request. No live speedup claim follows from the deterministic ordering test.

`FetcherSummary.queueWaitMs`, `HttpExchange.queueWaitMs` and request log `LogField.QueueWaitMs` separate scheduler-admission wait from HTTP timing. These diagnostics exclude waiting in the legacy fetcher FIFO gate. The summary sums overlapping waits. That sum is not elapsed time or time saved. Captured HTTP timing remains authoritative during replay. Without opt-in, the fetcher retains its existing FIFO admission gate and custom-scheduler behavior.

## Auto-throttle

`createRequestScheduler({ autoThrottle: { maxPerHost: 4 } })` lets a responsive host take more than one request at a time. It is off by default. Without it, each host has one request in flight, as before. The CLI, MCP server and task server create no scheduler, so a normal audit run never uses it.

Each host starts at one request in flight. After a full window of healthy answers, the host limit grows by one, up to `maxPerHost`. A window is as many healthy releases as the current limit. Any strain halves the limit, down to one. Strain is one of:

- a 5xx answer
- a request that ended without an answer, such as a timeout, a reset or a cancellation
- a request held longer than `slowMs` (default 5000 ms) from admission to release

A 404 or any other 2xx–4xx answer is healthy. `gapMs` still separates each release from the next admission to that host, so each slot keeps the configured pause. The 403, 429 and 503 rules are unchanged: they stop the host or start a cooldown whatever the limit.

The host limit is not part of `HostState` and is not exported or imported. Every new scheduler starts each host at one. `snapshot()` reports `activeRequests` and `hostLimit` per host. With ready admission, a fetcher's `maxConcurrent` still caps its own requests, so raise it above one for a scan to use more than one slot on a host.
