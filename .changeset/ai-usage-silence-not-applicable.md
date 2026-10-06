---
"@forkpoint/agent-lighthouse-core": patch
---

`access-crawl-control/ai-usage-signal-coherence-across-channels` no longer warns a site that declares no AI-usage preference in any channel. With nothing declared there is nothing to contradict, so the check is not applicable.
