---
audit: machine-discovery/sitemap-lastmod-verifiability
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/sitemap-lastmod-verifiability.ts
slug: sitemap-lastmod-verifiability
evidence_grade: A
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-22"
reviewed: 2026-08-20
graduated: 2026-08-22
sources:
  - google-sitemap-formats
  - sitemaps-protocol
---

# Sitemap lastmod verifiability (page-level cross-validation)

> Shipped in v2. Evidence grade **A** · scored tier · partial overlap · implementation: `multi-page`

## What it checks

Cross-validates every sampled sitemap <lastmod> against three independent page-level modification signals and scores agreement, rather than merely reporting that lastmod exists. Detects the two dominant failure modes: build-stamped lastmod (every URL updated on every deploy) and frozen lastmod (CMS never updates it).

## Claimed mechanism (falsifiable)

Google states it uses <lastmod> 'if it's consistently and verifiably (for example by comparing to the last modification of the page) accurate'. lastmod is therefore a conditional signal, which engines silently discard on divergence. It is also the only freshness hint a pull-based AI crawler gets from a sitemap. Falsifiable claim: if sampled lastmod values disagree with all available page-level evidence (HTTP Last-Modified, JSON-LD dateModified, article:modified_time) for a material fraction of URLs, the sitemap's freshness channel is inert and re-crawl scheduling degrades to organic rediscovery. A recent cluster of lastmod values is consistent with a build stamp only when page dates also disagree. A batch of genuine edits can produce the same cluster. The distribution alone proves no defect. A lastmod in the future relative to crawl time is invalid.

## Evidence

- **[Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)** — Google Search Central (vendor-doc, URL verified 2026-08-20)
  - Direct quote: 'Google uses the <lastmod> value if it's consistently and verifiably (for example by comparing to the last modification of the page) accurate.' The value 'should reflect the date and time of the last significant update to the page… an update to the copyright date is not [significant].' priority and changefreq are ignored. The limit per sitemap file is 50MB uncompressed and 50,000 URLs.
- **[Sitemaps XML format — protocol](https://www.sitemaps.org/protocol.html)** — sitemaps.org (spec, URL verified 2026-08-20)
  - lastmod must be W3C Datetime (YYYY-MM-DD or full timestamp). Path-scope rule. A sitemap at /catalog/sitemap.xml may only list URLs under /catalog/. All URLs must share protocol and host with the sitemap. A file is capped at 50,000 URLs and 50MB (52,428,800 bytes). An index file is capped at 50,000 sitemaps, and may only reference sitemaps on the same site.

## Example failure

A Hugo site regenerates every page on each deploy, so sitemap.xml lists 4,000 URLs all with lastmod=2026-08-19T04:11:00Z. The JSON-LD dateModified on those pages ranges from 2019 to 2026. Google and every pull crawler downweight the sitemap's lastmod entirely. A genuinely revised pricing page published 2026-08-18 therefore gets no priority over 4,000 unchanged archive pages, and is re-fetched weeks later. Meanwhile the site owner's SEO tool reports '100% of URLs have lastmod' as a pass.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Implementation deviations

- **Kept apart from `machine-discovery/sitemap-lastmod`.** That audit asks
  whether `lastmod` is present. This one asks whether it is true. Absence is
  `notApplicable` here, so one defect is not counted twice.
- **Subpath sitemap scope.** On a subpath homepage, the shared sitemap gatherer
  keeps only same-origin URLs under that directory, before sampling.
- **Deterministic sample.** `sampleEntries` takes an even stride of 6 URLs, so
  a re-scan probes the same pages.
- **Fetches are shared.** The sitemap tree is walked once per scan
  (`siteSitemapTree`). Sampled documents go through one per-scan cache
  (`fetchSampledPage`). Pages already in `ctx.pages` are reused first.
- **`og:updated_time` is a fourth page signal**, beside JSON-LD dates,
  `article:modified_time` and `last-modified` meta.
- **The modal share stands in for entropy.** A build stamp is a run covering
  over 90% of the sample, within 3 days of the scan.
- **A stamp run is one run, not one string.** Values inside a one-hour window
  count as one stamp, since generators write the clock per URL.
- **A cluster needs contradictory evidence.** It adds build-stamp context only
  when over 20% of comparable page dates also diverge by more than 7 days. A
  corroborated batch passes.
- **One hour of clock skew is tolerated** before a value counts as
  future-dated.
- **Contributed dates are skipped.** Dates on a nested `Review`, `Comment`,
  `Answer` or `Question` are not page signals. A top-level `Review` keeps its
  dates.
- **`Last-Modified` corroborates but cannot contradict.** On a static host it
  is the deploy time. A URL whose only signal is the header, and which
  disagrees with it, is unverifiable.
- **A deploy-time header cannot vouch for a stamp run.** When the sample has
  the stamp shape, the header is not compared at all.

## Deferred

- **Only the first level of a `<sitemapindex>` is walked**, per the shared
  gatherer.
- **The 7-day divergence window is fixed.** An adaptive window needs a
  publication-cadence estimate.
- **`Last-Modified` corroboration is taken at face value** outside the stamp
  shape. A response-time header agrees with almost any recent `lastmod`.
