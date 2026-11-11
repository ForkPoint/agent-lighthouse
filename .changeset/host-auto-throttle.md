---
"@forkpoint/agent-lighthouse-core": minor
---

Add opt-in `autoThrottle` to `createRequestScheduler`. A responsive host may take up to `maxPerHost` requests at once: the limit grows by one after a full window of healthy answers and halves on a 5xx, a request without an answer, or an answer whose headers came later than `slowMs`. Reading the body does not count as slowness. A request its caller aborted before any answer is not judged; one that got an answer is judged by it. The release function a scheduler returns now takes an optional `RequestOutcome` (status, header time, abort), so each request is judged by its own answer, and fields it leaves out keep what `observe` recorded; `RequestOutcome` and `RequestRelease` are exported. Off by default, so a scheduler without it still sends one request per host. `RequestQueueSnapshot` gains `activeRequests` and `hostLimit`, and `AutoThrottleOptions` is exported.
