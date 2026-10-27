---
"@forkpoint/agent-lighthouse-core": patch
---

Stop five more audits from treating a request with no HTTP response as a missing file or a site defect. A request the scheduler held back, a timeout or a transport failure is now reported as not assessed, with its cause:

- `answer-readiness/about-credentials` reuses the root phase's answers for the about-page paths and returns not applicable, instead of fail, when a path was never answered.
- `machine-discovery/rss-feed` no longer says "nothing at the common paths" for paths it never read, and no longer fails an advertised feed that got no response.
- `machine-discovery/conditional-request-support` no longer reads an unanswered conditional request as "answered with 200 rather than 304", and no longer says there is no robots.txt, sitemap or feed when those surfaces were simply not read.
- `machine-discovery/agent-commerce-feed-parity` no longer says the sitemap sample holds no product page when the sample was not read.
- `agent-interfaces/ai-catalog-exists` returns not applicable, instead of fail with "HTTP 0", when a well-known path got no response.
