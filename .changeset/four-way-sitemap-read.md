---
'@forkpoint/agent-lighthouse-core': major
---

refactor(core)!: perform four-way read of sitemaps and decline on absence

An absent sitemap now returns `notApplicable` for `sitemap-lastmod` and `sitemap-absolute-urls` instead of failing the site for an unwritten document.
