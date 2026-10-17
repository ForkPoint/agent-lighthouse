---
audit: machine-discovery/conditional-request-support
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/conditional-request-support.ts
slug: conditional-request-support
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - google-http-status-codes
  - google-reduce-crawl
  - sitemaps-protocol
  - indexnow-doc
---

# Conditional-request support on discovery surfaces

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `static-fetch`

## What it checks

Sitemaps and feeds are the two resources AI crawlers poll far more often than they fetch pages. Verifies that they emit stable revalidation validators, and honour If-None-Match and If-Modified-Since with a 304, instead of shipping a full body on every poll.

## Claimed mechanism (falsifiable)

Google documents that on a 304 'Google crawlers signal the next processing system that the content is the same as last time it was crawled', i.e. 304 is the supported mechanism for cheap freshness polling. Falsifiable claim. A sitemap or feed forces every polling agent to download the entire resource on every cycle in two cases: when it emits no ETag and no Last-Modified, and when it returns 200 with a full body in response to a correctly-formed conditional request. At 50,000-URL sitemap scale that is tens of megabytes per poll per agent. Repeated full transfers are what push origins into the 429 and 503 responses that Google explicitly documents as crawl-rate-reducing. A second, independently testable pathology: an ETag that differs between two byte-identical responses (commonly injected by a gzip/Brotli layer or a per-request CDN node id) makes revalidation permanently fail, producing the same full-transfer behaviour while appearing to be configured correctly.

## Evidence

- **[How HTTP status codes, and network and DNS errors affect Google Search](https://developers.google.com/search/docs/crawling-indexing/http-network-errors)** — Google Search Central (vendor-doc, URL verified 2026-08-20)
  - 304 Not Modified: 'Google crawlers signal the next processing system that the content is the same as last time it was crawled.' 5xx 'prompt Google's crawlers to temporarily slow down with crawling'. 4xx causes crawl frequency to gradually decrease. Up to 10 redirect hops followed.
- **[Reduce Googlebot crawl rate](https://developers.google.com/search/docs/crawling-indexing/reduce-crawl-rate)** — Google Search Central (vendor-doc, URL verified 2026-08-20)
  - Checked as a candidate source for 304/conditional-request guidance: it does not discuss 304, If-Modified-Since or If-None-Match. Only 500/503/429 are named as crawl-rate-reducing responses. Cited here to bound the evidence for the conditional-request proposal.
- **[Sitemaps XML format — protocol](https://www.sitemaps.org/protocol.html)** — sitemaps.org (spec, URL verified 2026-08-20)
  - lastmod must be W3C Datetime (YYYY-MM-DD or full timestamp). Path-scope rule. A sitemap at /catalog/sitemap.xml may only list URLs under /catalog/. All URLs must share protocol and host with the sitemap. A file is capped at 50,000 URLs and 50MB (52,428,800 bytes). An index file is capped at 50,000 sitemaps, and may only reference sitemaps on the same site.
- **[IndexNow Protocol Documentation](https://www.indexnow.org/documentation)** — IndexNow (Microsoft/Yandex) (spec, URL verified 2026-08-20)
  - Ownership is proven by hosting a UTF-8 text file at the host root named {key}.txt whose body is the key. Key must be 8-128 chars from [a-zA-Z0-9-]. Verification is a byte comparison. HTTP 403 is returned when the key is 'not found in the key file' or invalid. 422 signals a host or schema mismatch, 429 a rate limit, and 202 means 'key validation pending'. keyLocation restricts submittable URLs to the key file's directory and deeper. Batch POST accepts up to 10,000 URLs.

## Example failure

A 38MB sitemap index tree is served through a CDN configured with `Cache-Control: no-store` and dynamic Brotli compression that generates a fresh weak ETag per request. Six AI crawlers polling hourly each re-download the full tree every time. The origin's WAF starts issuing 429s to the noisiest agents. Per Google's documented handling of 429 and 5xx, that throttles crawling of the whole host — including the product pages the owner actually cares about. Every existing audit reports the sitemap as valid and reachable.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Implementation deviations

- **Renamed.** `conditional-request-support-on-discovery-surfaces` would exceed
  the 64-character id cap.
- **The probe lives in `gatherers/conditional.ts`**, so each surface is probed
  once per scan. Each surface costs four requests.
- **The surface set is capped.** It covers robots.txt, at most four sitemap
  URLs (declared, `/sitemap.xml`, then children), and up to two feeds.
- **Subpath sitemap scope.** On a subpath homepage, the shared sitemap gatherer
  limits child sitemaps to that directory.
- **The 50,000-URL limit is checked only on an untruncated sitemap walk.** Past
  the walk cap the true count is unknown.
- **The finding text carries the Googlebot caveat.** 304 semantics are
  documented for Googlebot. The assertion itself is HTTP conformance.
- **Weak `W/` validators are accepted.** The distinction matters for range
  requests, not for revalidation.
- **`Content-Encoding` is not recorded.** The paired requests hold encoding
  constant, which keeps the body-hash comparison sound.
