---
'@forkpoint/agent-lighthouse-core': minor
---

`FetchResult` now records the redirect chain it walked.

Each hop carries its status, the URL it left and the URL it went to. `finalUrl`
alone cannot say whether a host change was permanent: a scan has to tell a
domain migration (301/308) from a temporary hop to somebody else's domain, and
only the per-hop status answers that.

The field is optional and absent when the response was not a redirect, so
nothing that reads a `FetchResult` today changes.
