---
check: three-way-freshness-lag-and-orphaned-fresh-content
title: "Three-way freshness lag and orphaned fresh content"
domain: feeds-indexing
status: proposed
evidence_grade: B
uniqueness: partial-overlap
difficulty: multi-page
scoring_tier: scored
reviewed: 2026-08-20
---

# Three-way freshness lag and orphaned fresh content

> Proposed check. Evidence grade **B** · partial overlap · implementation: `multi-page`

## What it checks

Compares the newest content the site actually shows against the newest entry in its sitemap and its feed, and reports content that exists on the site but appears in neither push/pull surface. Also catches generator-level staleness where the feed's own build timestamp trails its newest item.

## Claimed mechanism (falsifiable)

A discovery surface is only useful if it is fresher than organic rediscovery — the stated premise of IndexNow ('it can take days or even weeks for new URLs to be discovered'). Falsifiable claim: any URL reachable from the homepage or a section index that is listed in neither the sitemap nor any feed is discoverable only by link-following, so a pull-based AI crawler that fetches sitemap and feed on a schedule will never see it on that schedule. Second falsifiable claim: when <lastBuildDate>/<feed><updated> is older than the newest item's own pubDate/atom:updated, the generator is not updating its own freshness header, and conditional-poll consumers that key off it will skip the feed entirely. Third: when the newest sitemap lastmod trails the newest on-page dateModified by more than a week, the sitemap is regenerated on a cadence slower than publication.

## Evidence

- **[IndexNow Protocol Documentation](https://www.indexnow.org/documentation)** — IndexNow (Microsoft/Yandex) (spec, URL verified 2026-08-20)
  - Ownership is proven by hosting a UTF-8 text file at the host root named {key}.txt whose body is the key. Key must be 8-128 chars from [a-zA-Z0-9-]. Verification is a byte comparison: HTTP 403 is returned when the key is 'not found in the key file' or invalid; 422 on host/schema mismatch; 429 on rate limit; 202 means 'key validation pending'. keyLocation restricts submittable URLs to the key file's directory and deeper. Batch POST accepts up to 10,000 URLs.
- **[IndexNow: Instantly Index your Web Content in Search Engines](https://blogs.bing.com/webmaster/october-2021/IndexNow-Instantly-Index-your-web-content-in-Search-Engines)** — Microsoft Bing Webmaster Blog (vendor-doc, URL verified 2026-08-20)
  - Confirms the key-file-at-root verification flow and the motivation (organic discovery 'can take days or even weeks'). No published crawl-latency SLA.
- **[Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)** — Google Search Central (vendor-doc, URL verified 2026-08-20)
  - Direct quote: 'Google uses the <lastmod> value if it's consistently and verifiably (for example by comparing to the last modification of the page) accurate.' lastmod 'should reflect the date and time of the last significant update to the page… an update to the copyright date is not [significant].' priority and changefreq are ignored. 50MB uncompressed / 50,000 URL limit per sitemap file.
- **[RFC 4287 — The Atom Syndication Format](https://www.rfc-editor.org/rfc/rfc4287)** — IETF (spec, URL verified 2026-08-20)
  - Sec 4.1.2: atom:entry MUST contain exactly one atom:id (permanent, universally unique IRI that 'must not change across different instantiations of the entry') and exactly one atom:updated ('most recent modification time that the publisher considers significant'). atom:entry MUST contain atom:summary when atom:content carries a src attribute (and is thus empty), or when content is Base64-encoded. MUST NOT contain more than one atom:summary.

## Competitor coverage

Screaming Frog and Sitebulb compute orphan URLs against a sitemap, and both list dead sitemap entries. Neither includes the feed as a third set, neither compares generator-level lastBuildDate against item dates, and neither computes the on-page-vs-sitemap-vs-feed freshness lag as a single finding. AI-visibility tools track citations, not ingestion-surface freshness.

## Implementation sketch

1) Build three sets: SITEMAP (all URLs from the sitemap tree, capped), FEED (all item links across discovered feeds), and SITE (URLs harvested from the homepage plus up to 5 section/index/blog-listing pages, restricted to same-host, non-paginated, HTML content-type after HEAD). 2) Compute ORPHANS = SITE \ (SITEMAP ∪ FEED); FAIL when |ORPHANS| > 0 and any orphan's on-page datePublished is within the last 30 days — report those URLs explicitly. 3) Compute newest_on_page = max(datePublished/dateModified across sampled SITE pages), newest_sitemap = max(lastmod), newest_feed = max(item date). FAIL when newest_on_page - newest_sitemap > 7 days, or newest_on_page - newest_feed > 7 days. 4) Assert feed-level <lastBuildDate>/<updated> >= max(item date); FAIL otherwise (generator bug). 5) Assert item ordering is newest-first, since many consumers read only the head of the feed; WARN on unordered feeds. 6) Report the inverse set too: SITEMAP \ SITE URLs that return 404/410/noindex — advertised-but-dead entries that waste every crawler's budget. All date parsing normalizes to UTC and ignores timezone-less values rather than guessing.

## Example failure

A news site migrates to a new CMS. The homepage lists 12 articles from the last 48 hours; sitemap.xml is regenerated nightly by a cron job that silently started failing 11 days ago, and the RSS feed is served from a CDN cache with a 30-day TTL and no purge hook. Every article of the last 11 days is an orphan in both surfaces. Link-following crawlers eventually find them; polling agents that fetch only sitemap.xml and /feed see a site that stopped publishing 11 days ago, and the site disappears from freshness-weighted answer surfaces while every page individually passes SEO audits.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
