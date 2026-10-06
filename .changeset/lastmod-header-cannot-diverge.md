---
"@forkpoint/agent-lighthouse-core": patch
---

`machine-discovery/sitemap-lastmod-verifiability` no longer fails a `lastmod` whose only disagreement is with the HTTP `Last-Modified` header. A static host sets that header on every deploy, so it can corroborate a content date but not contradict one; such URLs now count as unverifiable.
