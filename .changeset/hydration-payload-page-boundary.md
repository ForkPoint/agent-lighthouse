---
"@forkpoint/agent-lighthouse-core": patch
---

Keep hydration payloads from different page responses separate. Previously,
two individually valid payloads with the same name could combine into a false
single-payload size failure. The audit now attributes oversized payloads to
their own pages and resolves size ties in a stable order.

Chunks of the same named stream on one page still combine. Aggregate share
and duplication measurements remain unchanged pending the wider 7.0.0 review.
