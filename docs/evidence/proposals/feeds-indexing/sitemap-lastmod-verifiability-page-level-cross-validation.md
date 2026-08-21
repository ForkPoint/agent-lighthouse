---
check: sitemap-lastmod-verifiability-page-level-cross-validation
title: "Sitemap lastmod verifiability (page-level cross-validation)"
domain: feeds-indexing
status: proposed
evidence_grade: A
uniqueness: partial-overlap
difficulty: multi-page
scoring_tier: scored
reviewed: 2026-08-20
---

# Sitemap lastmod verifiability (page-level cross-validation)

> Proposed check. Evidence grade **A** · partial overlap · implementation: `multi-page`

## What it checks

Cross-validates every sampled sitemap <lastmod> against three independent page-level modification signals and scores agreement, rather than merely reporting that lastmod exists. Detects the two dominant failure modes: build-stamped lastmod (every URL updated on every deploy) and frozen lastmod (CMS never updates it).

## Claimed mechanism (falsifiable)

Google states it uses <lastmod> 'if it's consistently and verifiably (for example by comparing to the last modification of the page) accurate' — i.e. lastmod is a conditional signal that engines silently discard on divergence, and lastmod is the only freshness hint a pull-based AI crawler gets from a sitemap. Falsifiable claim: if sampled lastmod values disagree with all available page-level evidence (HTTP Last-Modified, JSON-LD dateModified, article:modified_time) for a material fraction of URLs, the sitemap's freshness channel is inert and re-crawl scheduling degrades to organic rediscovery. Two specific detectable pathologies: (a) >90% of URLs share one identical lastmod equal to the last deploy date — a build stamp, not a content date, which per Google's 'copyright date is not significant' rule is exactly the disqualifying pattern; (b) lastmod in the future relative to crawl time — always invalid.

## Evidence

- **[Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)** — Google Search Central (vendor-doc, URL verified 2026-08-20)
  - Direct quote: 'Google uses the <lastmod> value if it's consistently and verifiably (for example by comparing to the last modification of the page) accurate.' lastmod 'should reflect the date and time of the last significant update to the page… an update to the copyright date is not [significant].' priority and changefreq are ignored. 50MB uncompressed / 50,000 URL limit per sitemap file.
- **[Sitemaps XML format — protocol](https://www.sitemaps.org/protocol.html)** — sitemaps.org (spec, URL verified 2026-08-20)
  - lastmod must be W3C Datetime (YYYY-MM-DD or full timestamp). Path-scope rule: a sitemap at /catalog/sitemap.xml may only list URLs under /catalog/; all URLs must share protocol and host with the sitemap. 50,000 URLs / 50MB (52,428,800 bytes) per file; index files limited to 50,000 sitemaps and may only reference sitemaps on the same site.

## Competitor coverage

Screaming Frog, Sitebulb, Semrush and Ahrefs surface lastmod presence and can flag future dates, but none cross-validate lastmod against on-page JSON-LD dateModified / article:modified_time / Last-Modified, and none detect the build-stamp entropy collapse. Lighthouse's agentic category does not crawl sitemaps at all.

## Implementation sketch

1) Fetch robots.txt Sitemap: directives plus /sitemap.xml, /sitemap_index.xml; recurse <sitemapindex> one level. 2) Validate each lastmod parses as W3C Datetime (YYYY-MM-DD or full RFC3339); count malformed. 3) Reservoir-sample 30-50 URLs across all child sitemaps. 4) For each: GET, capture the Last-Modified response header; parse all JSON-LD blocks for dateModified/datePublished; parse <meta property="article:modified_time"> and <meta name="last-modified">. 5) Per URL compute min absolute delta between sitemap lastmod and any available page signal. 6) Report: %future-dated (FAIL if >0), %malformed, distribution entropy of lastmod values (FAIL if the modal value covers >90% of sampled URLs AND that value is within 3 days of the crawl date), and %URLs whose delta exceeds 7 days against every available signal (FAIL if >20%). 7) Report separately the %URLs with no page-level signal at all — that is an actionable sub-finding (add dateModified to JSON-LD) rather than a lastmod failure.

## Example failure

A Hugo site regenerates every page on each deploy, so sitemap.xml lists 4,000 URLs all with lastmod=2026-08-19T04:11:00Z. The JSON-LD dateModified on those pages ranges from 2019 to 2026. Google and every pull crawler downweight the sitemap's lastmod entirely, so a genuinely revised pricing page published 2026-08-18 gets no priority over 4,000 unchanged archive pages and is re-fetched weeks later — while the site owner's SEO tool reports '100% of URLs have lastmod' as a pass.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
