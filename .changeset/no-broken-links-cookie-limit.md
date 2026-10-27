---
"@forkpoint/agent-lighthouse-website": patch
---

Correct the `machine-discovery/no-broken-links` Limits text: a redirect loop reported for a link can come from a cookie set on an earlier page, which the probe does not send. A JavaScript challenge cannot cause it, because browsers do not run script in a redirect response.
