---
"@forkpoint/agent-lighthouse-core": minor
---

Release ready redirect leases after draining the response, before DNS safety validation. Keep all redirect safety checks and stop expired logical requests before another admission or transport call. Completed redirect hops no longer acquire timeout labels from later DNS waits.

`RequestAbortSource` gains `response-limit` for a body stopped at the response-size limit. Request diagnostics keep the first observed abort source, keep the first native error code when an outer wrapper supplies none, and report timing and protocol as unknown when Undici resends the same request after REFUSED_STREAM or GOAWAY.
