---
"@forkpoint/agent-lighthouse-core": major
---

The sitemap walk reads every sitemap robots.txt declares, and a broken sitemap is reported as broken.

- Every `Sitemap:` line in robots.txt is read. The walk used to stop at the first file that parsed, so a site declaring three sitemaps was judged on one. The conventional paths (`/sitemap.xml`, `/sitemap-index.xml`, `/sitemap_index.xml`) are probed only when no declared sitemap answers, and the first that does is taken.
- `readSitemap` follows the walk, not the first root file. A site whose only sitemap is a broken `/sitemap-index.xml`, or a broken file declared in robots.txt, now reads `malformed` instead of `absent`. `sitemap-exists`, `sitemap-lastmod` and `sitemap-absolute-urls` change verdict on such a site.
- A sitemap index may no longer pull in a child from a parent domain. `foo.github.io` reads children on `foo.github.io` and its subdomains only, never on `github.io`.
- `SitemapTree` gains `readableFiles` and `malformedFiles`; `collectSitemapEntries` gains `opts.fallbackRoots`.
