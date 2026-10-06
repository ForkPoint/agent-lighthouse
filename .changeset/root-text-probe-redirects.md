---
"@forkpoint/agent-lighthouse-core": patch
---

Stop failing `machine-discovery/root-text-file-resolution-integrity` when random `.txt` paths redirect to the homepage. A probe that is redirected to a different path now counts as a missing file, the same as a 404.
