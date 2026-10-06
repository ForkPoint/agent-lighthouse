---
"@forkpoint/agent-lighthouse-core": patch
---

`answer-readiness/section-split-risk-profile` still reports THIN sections but no longer warns on them alone. A section that fits the retrieval window is never cut, so only SPLIT, ATOMIC-SPLIT, BLOB or a low in-window score now warn.
