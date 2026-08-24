---
"@forkpoint/agent-lighthouse-core": major
---

`agent-interfaces/agents-json` no longer fails a site for not serving
`/.well-known/agents.json`, and no longer reports any parseable JSON at that
path as adoption.

The audit's own evidence records `Consumers: none-known` and recommends
deleting the signal: the agents.json specification never moved past v0.1.0, its
repository has been dormant since 2025-08-21, both of its project domains are
offline, and the path is absent from the IANA Well-Known URIs registry. The
audit nonetheless failed every site at medium priority and prescribed a schema
(`protocols`, `authentication`, `rate_limits`, `endpoints`) that no agents.json
consumer can read, behind a documentation link whose domain no longer resolves.
Anyone who followed that advice wrote an unusable file.

Absence is now reported as not-applicable, which leaves it out of scoring
entirely. A published file is validated against the shape the specification
actually defines — an `info` object plus a `sources` or `flows` array — so `[]`,
`{}` and unrelated config files no longer pass. A path answering HTTP 200 with
the site's HTML shell is named as what it is, a well-known path claiming
adoption the site does not have, rather than reported as invalid JSON; a clean
404 is treated as honest and is never penalised. A valid document served with a
`text/html` content type gets its own, milder warning about the media type
instead of being accused of containing HTML. The audit can no longer return a
failure of any kind, its default priority drops from medium to low, and the
remediation snippet and documentation link now point at the real specification.

No score moves in either direction: the audit was already informative at weight
0, and the evidence does not support raising it — grade C carries no scoring
weight under the evidence policy. What changes is what reports say. Every
scanned site without the file loses an `agents.json` failure row, and any site
publishing placeholder JSON at that path loses a pass it should never have had.
