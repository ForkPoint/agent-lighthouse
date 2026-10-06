---
"@forkpoint/agent-lighthouse-core": patch
---

`machine-discovery/rss-feed` is now not applicable when a site neither publishes nor advertises a feed, instead of failing. A feed advertised by an autodiscovery link that does not answer still fails.
