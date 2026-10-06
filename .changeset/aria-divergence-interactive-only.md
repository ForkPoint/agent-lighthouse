---
"@forkpoint/agent-lighthouse-core": patch
---

`operability-safety/aria-layer-injection-scan` compares an `aria-label` with its visible text only on controls and widget roles, so a landmark or container label such as `nav aria-label="Main"` is no longer reported as divergent. Every label is still checked for instruction text.
