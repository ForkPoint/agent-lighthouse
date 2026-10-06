---
"@forkpoint/agent-lighthouse-core": patch
---

Stop failing `machine-discovery/discovery-index-coverage` when the sitemap is larger than the scan reads. A page missing from a partial sitemap read now returns not applicable instead of "Not indexed".
