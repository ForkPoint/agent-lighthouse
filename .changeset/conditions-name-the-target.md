---
"@forkpoint/agent-lighthouse-core": patch
---

`conditions.pageType` describes the target URL. When the target did not answer 200 and a page override did, the first surviving page was the override and the conditions block described it under the target's URL. The page type now comes from the target's own entry, or from the explicit fallback when the target was not read.
