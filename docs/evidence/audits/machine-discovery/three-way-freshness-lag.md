---
audit: machine-discovery/three-way-freshness-lag
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/three-way-freshness-lag.ts
slug: three-way-freshness-lag
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - indexnow-doc
  - bing-indexnow
  - google-sitemap-formats
  - rfc4287
---

# Three-way freshness lag and orphaned fresh content

> Shipped in v2. Evidence grade **B** · scored tier · partial overlap · implementation: `multi-page`

## What it checks

Compares the newest content the site actually shows against the newest entry in its sitemap and its feed, and reports content that exists on the site but appears in neither push/pull surface. Also catches generator-level staleness where the feed's own build timestamp trails its newest item.

## Claimed mechanism (falsifiable)

A discovery surface is only useful if it is fresher than organic rediscovery — the stated premise of IndexNow ('it can take days or even weeks for new URLs to be discovered'). Falsifiable claim: a URL reachable from the homepage or a section index, but listed in neither the sitemap nor any feed, is discoverable only by link-following. A pull-based AI crawler that fetches sitemap and feed on a schedule will never see it on that schedule. Second falsifiable claim: when <lastBuildDate>/<feed><updated> is older than the newest item's own pubDate/atom:updated, the generator is not updating its own freshness header, and conditional-poll consumers that key off it will skip the feed entirely. Third: when the newest sitemap lastmod trails the newest on-page dateModified by more than a week, the sitemap is regenerated on a cadence slower than publication.

## Evidence

- **[IndexNow Protocol Documentation](https://www.indexnow.org/documentation)** — IndexNow (Microsoft/Yandex) (spec, URL verified 2026-08-20)
  - Ownership is proven by hosting a UTF-8 text file at the host root named {key}.txt whose body is the key. Key must be 8-128 chars from [a-zA-Z0-9-]. Verification is a byte comparison. HTTP 403 is returned when the key is 'not found in the key file' or invalid. 422 signals a host or schema mismatch, 429 a rate limit, and 202 means 'key validation pending'. keyLocation restricts submittable URLs to the key file's directory and deeper. Batch POST accepts up to 10,000 URLs.
- **[IndexNow: Instantly Index your Web Content in Search Engines](https://blogs.bing.com/webmaster/october-2021/IndexNow-Instantly-Index-your-web-content-in-Search-Engines)** — Microsoft Bing Webmaster Blog (vendor-doc, URL verified 2026-08-20)
  - Confirms the key-file-at-root verification flow and the motivation (organic discovery 'can take days or even weeks'). No published crawl-latency SLA.
- **[Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)** — Google Search Central (vendor-doc, URL verified 2026-08-20)
  - Direct quote: 'Google uses the <lastmod> value if it's consistently and verifiably (for example by comparing to the last modification of the page) accurate.' The value 'should reflect the date and time of the last significant update to the page… an update to the copyright date is not [significant].' priority and changefreq are ignored. The limit per sitemap file is 50MB uncompressed and 50,000 URLs.
- **[RFC 4287 — The Atom Syndication Format](https://www.rfc-editor.org/rfc/rfc4287)** — IETF (spec, URL verified 2026-08-20)
  - Sec 4.1.2: atom:entry MUST contain exactly one atom:id and exactly one atom:updated. The id is a permanent, universally unique IRI that 'must not change across different instantiations of the entry'. The updated time is the 'most recent modification time that the publisher considers significant'. atom:entry MUST also contain atom:summary in two cases: when atom:content carries a src attribute, and is thus empty, and when content is Base64-encoded. MUST NOT contain more than one atom:summary.

## Example failure

A news site migrates to a new CMS. The homepage lists 12 articles from the last 48 hours. sitemap.xml is regenerated nightly by a cron job that silently started failing 11 days ago. The RSS feed is served from a CDN cache with a 30-day TTL and no purge hook. Every article of the last 11 days is an orphan in both surfaces. Link-following crawlers eventually find them; polling agents that fetch only sitemap.xml and /feed see a site that stopped publishing 11 days ago, and the site disappears from freshness-weighted answer surfaces while every page individually passes SEO audits.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Implementation deviations

- **Renamed** from `three-way-freshness-lag-and-orphaned-fresh-content`, which
  exceeds the 64-character id cap. Only the freshness half ships here.
- **The orphan set is not computed.** `machine-discovery/discovery-index-coverage`
  owns it, so one defect is not scored twice.
- **The SITE set is the pages the scan already fetched.** No extra section or
  listing pages are crawled.
- **Lag is one number per surface**, not per URL. Per-URL comparison is
  `machine-discovery/sitemap-lastmod-verifiability`.
- **Subpath sitemap scope.** On a subpath homepage, the shared sitemap gatherer
  keeps only same-origin URLs under that directory.
- **Every date goes through `parseFeedDate`.** A timestamp without a timezone
  yields `undefined` rather than a guess. Sitemap `<lastmod>` must also pass
  `isW3CDateTime`.
- **Dead sitemap URLs are sampled, not swept.** `sampleEntries` takes 5 URLs
  across the tree.
- **A dead URL or an unordered feed warns; a lag fails.** A sampled 404 shows
  a stale sitemap but does not measure how stale.
- **The IndexNow sources carry one point only:** organic rediscovery takes days
  to weeks. The Google sitemap doc supports the `<lastmod>` assertion, and RFC
  4287 supports reading `atom:updated`.
