---
"@forkpoint/agent-lighthouse-core": minor
---

`machine-discovery/feed-entry-identity-and-canonical-integrity` no longer warns when a feed is served as `application/xml` or `text/xml`. Every feed reader parses a generic XML type, and no source names a consumer that treats it worse; `application/rss+xml` was never registered with IANA. The type is still recorded under `details.warnings`, and a non-XML type such as `text/html` still fails.
