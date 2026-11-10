---
"@forkpoint/agent-lighthouse-core": minor
---

Add opt-in `autoThrottle` to `createRequestScheduler`. A responsive host may take up to `maxPerHost` requests at once: the limit grows by one after a full window of healthy answers and halves on a 5xx, a request without an answer, or an answer whose headers came later than `slowMs`. A request its caller aborted is not judged. The release function a scheduler returns now takes an optional `RequestOutcome` (status, header time, abort), so each request is judged by its own answer; `RequestOutcome` and `RequestRelease` are exported. Off by default, so a scheduler without it still sends one request per host. `RequestQueueSnapshot` gains `activeRequests` and `hostLimit`, and `AutoThrottleOptions` is exported.
