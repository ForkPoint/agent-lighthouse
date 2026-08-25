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

## Competitor coverage

Screaming Frog and Sitebulb compute orphan URLs against a sitemap, and both list dead sitemap entries. Neither includes the feed as a third set, neither compares generator-level lastBuildDate against item dates, and neither computes the on-page-vs-sitemap-vs-feed freshness lag as a single finding. AI-visibility tools track citations, not ingestion-surface freshness.

## Implementation sketch

1) Build three sets: SITEMAP (all URLs from the sitemap tree, capped), FEED (all item links across discovered feeds), and SITE (URLs harvested from the homepage plus up to 5 section/index/blog-listing pages, restricted to same-host, non-paginated, HTML content-type after HEAD). 2) Compute ORPHANS = SITE \ (SITEMAP ∪ FEED); FAIL when |ORPHANS| > 0 and any orphan's on-page datePublished is within the last 30 days — report those URLs explicitly. 3) Compute newest_on_page = max(datePublished/dateModified across sampled SITE pages), newest_sitemap = max(lastmod), newest_feed = max(item date). FAIL when newest_on_page - newest_sitemap > 7 days, or newest_on_page - newest_feed > 7 days. 4) Assert feed-level <lastBuildDate>/<updated> >= max(item date); FAIL otherwise (generator bug). 5) Assert item ordering is newest-first, since many consumers read only the head of the feed; WARN on unordered feeds. 6) Report the inverse set too: SITEMAP \ SITE URLs that return 404/410/noindex — advertised-but-dead entries that waste every crawler's budget. All date parsing normalizes to UTC and ignores timezone-less values rather than guessing.

## Example failure

A news site migrates to a new CMS. The homepage lists 12 articles from the last 48 hours. sitemap.xml is regenerated nightly by a cron job that silently started failing 11 days ago. The RSS feed is served from a CDN cache with a 30-day TTL and no purge hook. Every article of the last 11 days is an orphan in both surfaces. Link-following crawlers eventually find them; polling agents that fetch only sitemap.xml and /feed see a site that stopped publishing 11 days ago, and the site disappears from freshness-weighted answer surfaces while every page individually passes SEO audits.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

**Renamed** from `three-way-freshness-lag-and-orphaned-fresh-content`, which
would make a 71-character id, and because only the freshness half ships here.

**The orphan half is deliberately not recomputed.** Sketch steps 1 and 2 build
SITE, SITEMAP and FEED sets and report `SITE \ (SITEMAP ∪ FEED)`.
`machine-discovery/discovery-index-coverage` already owns that computation and
already reports the URLs it finds. Running it a second time here would report
one defect twice, in two audits, with two scores against it — which is exactly
the double-counting the v2 restructure removes. What ships is steps 3, 4, 5 and
the advertised-but-dead half of step 6.

**Every date is read with `parseFeedDate`**, the strict parser from
`gatherers/feeds.ts`: a timestamp carrying no timezone yields `undefined`
rather than being read in the scanner's own offset. The audit measures a lag in
days and the guess is worth up to a day of it. Sitemap `<lastmod>` additionally
has to pass `isW3CDateTime` before it counts, which is the sitemap protocol's
own requirement.

**Dead sitemap URLs are sampled, not swept.** Five URLs, chosen by
`sampleEntries` across the whole tree, because each one is a request. A dead
entry is a systemic defect — a stale generator — and five spread samples find a
systemic defect if it is there.

**A dead URL or an unordered feed warns; a lag fails.** The sketch marks
ordering as a warning already. The advertised-but-dead set is reported at the
same level because a sampled 404 is evidence of a stale sitemap, not a
measurement of how stale.

**Evidence hygiene.** The dossier's first two sources are IndexNow
documentation, which belongs to
`machine-discovery/root-text-file-resolution-integrity`; only the phrase they
support — that organic rediscovery takes days to weeks, which is why a
discovery surface has to be fresher than it — bears on this audit. The Google
sitemap documentation supports the `<lastmod>` assertion and RFC 4287 supports
reading `atom:updated` as the item's own modification time.

## Deferred

- **The orphan set.** Owned by `machine-discovery/discovery-index-coverage`.
- **Crawling section index pages to widen the SITE set.** The audit reads the
  dates on the pages the scan already fetched. Fetching five more listing pages
  to find more dates would change the request budget without changing what a
  seven-day lag means.
- **Per-URL lag.** The finding is about a surface's regeneration cadence, which
  is one number for the whole surface. A per-URL comparison is
  `machine-discovery/sitemap-lastmod-verifiability`.
