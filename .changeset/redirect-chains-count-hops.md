---
"@forkpoint/agent-lighthouse-core": patch
---

`access-crawl-control/no-redirect-chains` no longer counts a single same-site redirect, such as http to https or bare domain to `www`, as a chain. Pages reached through two or more hops, or through one hop to another site, still count.
