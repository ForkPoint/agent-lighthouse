---
check: conditional-request-support-on-discovery-surfaces
title: "Conditional-request support on discovery surfaces"
domain: feeds-indexing
status: proposed
evidence_grade: B
uniqueness: unique
difficulty: static-fetch
scoring_tier: scored
reviewed: 2026-08-20
---

# Conditional-request support on discovery surfaces

> Proposed check. Evidence grade **B** · unique · implementation: `static-fetch`

## What it checks

Verifies that sitemaps and feeds — the two resources AI crawlers poll far more often than they fetch pages — emit stable revalidation validators and honour If-None-Match / If-Modified-Since with a 304, instead of shipping a full body on every poll.

## Claimed mechanism (falsifiable)

Google documents that on a 304 'Google crawlers signal the next processing system that the content is the same as last time it was crawled', i.e. 304 is the supported mechanism for cheap freshness polling. Falsifiable claim: a sitemap or feed that emits no ETag and no Last-Modified, or that returns 200 with a full body in response to a correctly-formed conditional request, forces every polling agent to download the entire resource on every cycle; at 50,000-URL sitemap scale that is tens of megabytes per poll per agent, and repeated full transfers are what push origins into the 429/503 responses that Google explicitly documents as crawl-rate-reducing. A second, independently testable pathology: an ETag that differs between two byte-identical responses (commonly injected by a gzip/Brotli layer or a per-request CDN node id) makes revalidation permanently fail, producing the same full-transfer behaviour while appearing to be configured correctly.

## Evidence

- **[How HTTP status codes, and network and DNS errors affect Google Search](https://developers.google.com/search/docs/crawling-indexing/http-network-errors)** — Google Search Central (vendor-doc, URL verified 2026-08-20)
  - 304 Not Modified: 'Google crawlers signal the next processing system that the content is the same as last time it was crawled.' 5xx 'prompt Google's crawlers to temporarily slow down with crawling'. 4xx causes crawl frequency to gradually decrease. Up to 10 redirect hops followed.
- **[Reduce Googlebot crawl rate](https://developers.google.com/search/docs/crawling-indexing/reduce-crawl-rate)** — Google Search Central (vendor-doc, URL verified 2026-08-20)
  - Checked as a candidate source for 304/conditional-request guidance: it does NOT discuss 304, If-Modified-Since or If-None-Match. Only 500/503/429 are named as crawl-rate-reducing responses. Cited here to bound the evidence for the conditional-request proposal.
- **[Sitemaps XML format — protocol](https://www.sitemaps.org/protocol.html)** — sitemaps.org (spec, URL verified 2026-08-20)
  - lastmod must be W3C Datetime (YYYY-MM-DD or full timestamp). Path-scope rule: a sitemap at /catalog/sitemap.xml may only list URLs under /catalog/; all URLs must share protocol and host with the sitemap. 50,000 URLs / 50MB (52,428,800 bytes) per file; index files limited to 50,000 sitemaps and may only reference sitemaps on the same site.
- **[IndexNow Protocol Documentation](https://www.indexnow.org/documentation)** — IndexNow (Microsoft/Yandex) (spec, URL verified 2026-08-20)
  - Ownership is proven by hosting a UTF-8 text file at the host root named {key}.txt whose body is the key. Key must be 8-128 chars from [a-zA-Z0-9-]. Verification is a byte comparison: HTTP 403 is returned when the key is 'not found in the key file' or invalid; 422 on host/schema mismatch; 429 on rate limit; 202 means 'key validation pending'. keyLocation restricts submittable URLs to the key file's directory and deeper. Batch POST accepts up to 10,000 URLs.

## Competitor coverage

No SEO or AI-visibility tool issues conditional requests against sitemaps or feeds or tests validator stability across repeated fetches; log-file analysers can observe the symptom after the fact but only for sites that ship server logs. Lighthouse measures page-level caching for performance, never the discovery-surface polling path.

## Implementation sketch

For each of /robots.txt, every Sitemap: target, each child sitemap (cap 3), and each discovered feed: (1) GET and record ETag, Last-Modified, Content-Length, Content-Encoding, Cache-Control, and a SHA-256 of the decoded body. (2) Immediately GET again with identical Accept-Encoding and assert the body hash is unchanged; if it is unchanged but the ETag differs, FAIL as 'unstable validator' and report both ETag values. (3) Issue a third GET with If-None-Match set to the first ETag (when present) and assert 304 with an empty body; FAIL on 200. (4) Issue a fourth GET with If-Modified-Since set to the Last-Modified value (when present) and assert 304; FAIL on 200. (5) When neither validator is emitted at all, FAIL as 'no revalidation possible' and report the uncompressed byte size that every poll therefore costs. (6) WARN when Cache-Control includes no-store or private on a public discovery surface, and when a sitemap exceeds 50MB uncompressed or 50,000 URLs (hard spec limits that also make the missing-validator cost concrete). (7) Report per-surface: validators_present, honours_inm, honours_ims, validator_stable, bytes_per_poll. Note in the finding text that the 304 semantics are documented for Googlebot and generalized here by analogy — the check itself is a pure HTTP conformance assertion and does not depend on that generalization.

## Example failure

A 38MB sitemap index tree is served through a CDN configured with `Cache-Control: no-store` and dynamic Brotli compression that generates a fresh weak ETag per request. Six AI crawlers polling hourly each re-download the full tree every time; the origin's WAF starts issuing 429s to the noisiest agents, which — per Google's documented handling of 429/5xx — throttles crawling of the whole host, including the product pages the owner actually cares about. Every existing audit reports the sitemap as valid and reachable.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
