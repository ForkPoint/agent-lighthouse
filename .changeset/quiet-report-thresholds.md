---
"@forkpoint/agent-lighthouse": patch
"@forkpoint/agent-lighthouse-core": patch
---

Reject malformed, non-finite, missing, and out-of-range CLI score thresholds before scanning. Keep zero thresholds valid. Guard tier and recommendation lookups against inherited object keys.

Keep the latest selected report in the website viewer, announce unscored reports clearly, and show manual-copy guidance when clipboard support is unavailable.
