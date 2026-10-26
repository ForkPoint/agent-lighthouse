---
"@forkpoint/agent-lighthouse-core": patch
---

Correct broken-link verdicts when probes have no HTTP response. Reuse identical stylesheet responses within a scan while retaining page cascade order. Stop redirect chains when a URL, effective method and cookie state repeat.

Count confirmed redirect loops and redirect chains that reach the 20-hop limit as broken navigation in `machine-discovery/no-broken-links`; a chain at the limit previously passed. Keep capture and replay timing identical when a capture callback takes time.
