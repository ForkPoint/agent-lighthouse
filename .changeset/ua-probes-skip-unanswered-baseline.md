---
"@forkpoint/agent-lighthouse-core": patch
---

Stop a dead host from using up the scan budget.

- A host that refuses a connection, times out on connect or does not resolve is tried once per scan. Later fetches to it return the same error at once. The scanned site's own hosts are never skipped this way.
- Crawler user-agent probes skip a URL whose browser baseline got no HTTP answer. Such a probe was always reported as "baseline blocked" and never changed a verdict. `ai-crawler-edge-parity` now says "No probe completed" when every baseline went unanswered, instead of "answered with HTTP 0".

A sitemap that listed a few URLs on a load-balancer host that never accepts a connection made the scan wait out one 10 s connect timeout per URL and per crawler, one after another, until the 180 s budget ran out.
