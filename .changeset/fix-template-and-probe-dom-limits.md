---
"@forkpoint/agent-lighthouse-core": patch
---

Count template content toward HTTP and browser-snapshot DOM work limits. Keep completed crawler probe findings when another response exceeds the DOM limits, and continue probing other crawlers and URLs. Cache excluded comparisons without discarding other results. The agent-UA content divergence audit drops only a crawler or control response that exceeds the limits, instead of failing the whole audit.
