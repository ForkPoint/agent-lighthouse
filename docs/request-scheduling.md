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

## Origin transport capacity

`createRequestScheduler({ originCapacity: true })` adds an opt-in bound per exact origin. Unknown origins start at 1. One ordinary bootstrap request may enter transport before peer SETTINGS arrives. A later peer limit of 0 blocks new grants and leaves that existing lease intact. It does not imply zero earlier send attempts. An adapter calls `updateOriginCapacity(origin, capacity)` with the usable connection capacity. Zero holds pending work. `null` resets a closed connection to unknown (1). Grants reserve origin, normalized-host, owner and global capacity together. Waiting work holds none of these permits. Lower capacity does not cancel existing leases. `HostState` stays unchanged. Queue snapshots optionally include `origins` with capacity and active counts.

Core does not infer peer SETTINGS through private Undici symbols. An adapter must report effective transport capacity from a supported transport. A custom or unpatched SDK transport still works with standard diagnostics; it must not claim peer capacity that it cannot observe. The external corpus pins its own narrow Undici diagnostics patch and filters events by owned public Client identity and socket identity. That adapter requires one connection per origin.

Ready scans complete robots and the primary page's full HTTP redirect chain before bulk root probes. Subpage scans also complete the origin homepage first. Legacy scheduling keeps its original ordering. Every planned root probe remains present, subject to the existing refusal and budget rules.

Ready fetches drain each redirect response and release its execution lease before awaiting redirect DNS safety checks. Every safety gate still runs before the next hop. A completed hop stops collecting transport abort events during that later validation. The existing logical request clock still includes validation, but an expired request cannot acquire another lease or start another transport call. Scheduler wait stays outside that clock. Legacy redirect ordering and replay timing remain unchanged.

## Transport diagnostics

A supplied custom fetcher must configure its own diagnostics. `runScan` rejects `requestDiagnostics: true` alongside a supplied fetcher. The default custom-fetcher path remains unchanged.

Set `requestDiagnostics: true` on `createFetcher` or `runScan` to add optional `HttpExchange.diagnostics` and per-hop `Request exchange` log records. Fetch IDs and hop numbers correlate requests within a fetcher. Scan log context identifies the scan. The corpus request-log sink adds run and attempt IDs. Each record includes its method, observed response status, failure message and scheduler wait. Existing terminal request logs and replay clocks keep their meaning.

Standard Undici diagnostic channels report request creation, the headers-send event, response headers, body end and transport error. `headersSent: true` means Undici emitted `sendHeaders`, immediately before its H1 write or H2 stream creation. It does not prove socket flush or peer receipt. Async-local request context captures the actual Undici request object at creation. Later callbacks use object identity. Equal URLs never share timing records. Diagnostics callbacks never read or log raw headers, credentials or private transport symbols.

`transportWaitMs` measures transport invocation to headers-sent, including any connection work. `responseWaitMs` measures headers-sent to response headers. `bodyMs` measures response headers to body end. Missing events produce `null`, including `headersSent`; a missing send event is not proof that nothing was sent. `connectionSetupMs` remains `null`: standard connection events cannot safely attribute connection setup to an individual queued request or multiplexed stream. No separate connection-setup claim follows from this data.

`RequestAbortSource` distinguishes request timeout, site budget, caller cancellation, scheduler refusal, transport error and the intentional response-size limit. A body-limit stop records `response-limit` before iterator cleanup; a resulting Undici error event remains an event fact, not a network-failure classification. `runScan` supplies the actual budget signal to its fetcher. A direct fetcher may pass `budgetSignal` alongside a composed request signal for the same attribution. The first composed signal reason governs attribution. Later aborts do not replace it. A response or body failure preserves any HTTP evidence already observed. These fields do not alter captured timing or replay consumption.

## GET reuse gate

The request-efficiency review retained existing scan-owned gatherer sharing. `gatherers/cache-owner.ts` preserves ownership across audit context copies. Feed documents, discovery, sampled pages and UA parity already share their service work. `gatherers/conditional.ts` deliberately sends two equal GETs to test body and ETag stability. Combining those transfers would change the audit evidence.

Generic GET reuse remains deferred. Equal URL, method and User-Agent log records do not establish complete header, cookie, credential, redirect-policy or response-variant equivalence. Replay consumes each captured exchange once and has no shared logical-call/transfer identity. No generic in-flight map or completed-response cache was added. No avoided-transfer count is claimed.

## Review clarifications

Owner FIFO applies within each normalized-host queue. If an owner's first request waits on one origin, its later request to another origin on that same host also waits. Other owners and other hosts can still proceed. Origin admission does not reorder that owner's work.

An ordinary connection disconnect resets the origin to unknown capacity1. Whole-Agent shutdown is terminal: the corpus adapter sets capacity0 for every factory-owned origin, including H1 origins that never publish H2 settings. It admits no further queued work for those origins. The caller aborts pending request signals to settle them. Shutdown removes the subscription and ownership references even if a capacity callback throws; it still calls the real Agent method and preserves that method's error.

Native diagnostics listeners install once on the first enabled request, not on module import or disabled fetches. The first native error code remains available when an outer transport wrapper supplies no code. Native REFUSED_STREAM or GOAWAY handling can resend the same Undici request. The collector counts those send events internally without adding a public field, retry API or policy. More than one send makes the combined transport/response/body timing and protocol unknown; first observed event facts remain intact.

If a composed request signal and its budget input already aborted with the same reason before observation, diagnostics cannot prove which source came first. Attribution remains `null` through the failure path. Actively observed aborts still retain their first source. A failed exchange with null attribution is unknown, while a successful exchange with null attribution records no abort.
