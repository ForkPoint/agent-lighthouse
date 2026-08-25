---
'@forkpoint/agent-lighthouse-core': patch
---

Fix `operability-safety/stateful-control-introspectability` erroring on every
page that holds a state-bearing control. `details.opaque` carried objects,
which `AuditResultSchema` rejects; each finding is now one line of text.
