---
"@forkpoint/agent-lighthouse-core": patch
---

Fix two false readings in `machine-discovery/sitemap-lastmod-verifiability`. Dates on nested reviews, comments, questions and answers no longer count as the page's modification time, so a product page with customer reviews and no page date is unverifiable, not divergent. Lastmod values written seconds apart in one generator run now count as one build stamp.
