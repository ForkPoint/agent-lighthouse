---
"@forkpoint/agent-lighthouse-core": minor
---

Add opt-in `autoThrottle` to `createRequestScheduler`. A responsive host may take up to `maxPerHost` requests at once: the limit grows by one after a full window of healthy answers and halves on a 5xx, a request without an answer, or a request slower than `slowMs`. Off by default, so a scheduler without it still sends one request per host. `RequestQueueSnapshot` gains `activeRequests` and `hostLimit`, and `AutoThrottleOptions` is exported.
