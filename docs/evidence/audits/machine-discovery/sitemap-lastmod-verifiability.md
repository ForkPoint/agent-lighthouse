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

Google states it uses <lastmod> 'if it's consistently and verifiably (for example by comparing to the last modification of the page) accurate'. lastmod is therefore a conditional signal, which engines silently discard on divergence. It is also the only freshness hint a pull-based AI crawler gets from a sitemap. Falsifiable claim: if sampled lastmod values disagree with all available page-level evidence (HTTP Last-Modified, JSON-LD dateModified, article:modified_time) for a material fraction of URLs, the sitemap's freshness channel is inert and re-crawl scheduling degrades to organic rediscovery. Two pathologies are specifically detectable. First, more than 90% of URLs share one identical lastmod equal to the last deploy date. That is a build stamp rather than a content date, and per Google's 'copyright date is not significant' rule it is exactly the disqualifying pattern. Second, a lastmod in the future relative to crawl time, which is always invalid.

## Evidence

- **[Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)** — Google Search Central (vendor-doc, URL verified 2026-08-20)
  - Direct quote: 'Google uses the <lastmod> value if it's consistently and verifiably (for example by comparing to the last modification of the page) accurate.' The value 'should reflect the date and time of the last significant update to the page… an update to the copyright date is not [significant].' priority and changefreq are ignored. The limit per sitemap file is 50MB uncompressed and 50,000 URLs.
- **[Sitemaps XML format — protocol](https://www.sitemaps.org/protocol.html)** — sitemaps.org (spec, URL verified 2026-08-20)
  - lastmod must be W3C Datetime (YYYY-MM-DD or full timestamp). Path-scope rule: a sitemap at /catalog/sitemap.xml may only list URLs under /catalog/; all URLs must share protocol and host with the sitemap. 50,000 URLs / 50MB (52,428,800 bytes) per file; index files limited to 50,000 sitemaps and may only reference sitemaps on the same site.

## Competitor coverage

Screaming Frog, Sitebulb, Semrush and Ahrefs surface lastmod presence and can flag future dates, but none cross-validate lastmod against on-page JSON-LD dateModified / article:modified_time / Last-Modified, and none detect the build-stamp entropy collapse. Lighthouse's agentic category does not crawl sitemaps at all.

## Implementation sketch

1) Fetch robots.txt Sitemap: directives plus /sitemap.xml, /sitemap_index.xml; recurse <sitemapindex> one level. 2) Validate each lastmod parses as W3C Datetime (YYYY-MM-DD or full RFC3339); count malformed. 3) Reservoir-sample 30-50 URLs across all child sitemaps. 4) For each: GET, capture the Last-Modified response header; parse all JSON-LD blocks for dateModified/datePublished; parse <meta property="article:modified_time"> and <meta name="last-modified">. 5) Per URL compute min absolute delta between sitemap lastmod and any available page signal. 6) Report: %future-dated (FAIL if >0), %malformed, distribution entropy of lastmod values (FAIL if the modal value covers >90% of sampled URLs AND that value is within 3 days of the crawl date), and %URLs whose delta exceeds 7 days against every available signal (FAIL if >20%). 7) Report separately the %URLs with no page-level signal at all — that is an actionable sub-finding (add dateModified to JSON-LD) rather than a lastmod failure.

## Example failure

A Hugo site regenerates every page on each deploy, so sitemap.xml lists 4,000 URLs all with lastmod=2026-08-19T04:11:00Z. The JSON-LD dateModified on those pages ranges from 2019 to 2026. Google and every pull crawler downweight the sitemap's lastmod entirely. A genuinely revised pricing page published 2026-08-18 therefore gets no priority over 4,000 unchanged archive pages, and is re-fetched weeks later. Meanwhile the site owner's SEO tool reports '100% of URLs have lastmod' as a pass.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Not a duplicate of `machine-discovery/sitemap-lastmod`

The two audits ask different questions and must not be collapsed into one:

| Audit | Question | Fails when |
| --- | --- | --- |
| `machine-discovery/sitemap-lastmod` | Is `lastmod` **present**? | The sitemap omits it, or omits it on most URLs. |
| `machine-discovery/sitemap-lastmod-verifiability` | Is `lastmod` **true**? | The values that exist contradict the pages, are future-dated, or are one deploy stamp repeated. |

A sitemap can pass the first and fail this one, which is the common case: the
CMS emits `lastmod` on every URL and rewrites all of them on every build.
Absence is `notApplicable` here, never a failure — with no values there is
nothing to verify, and reporting it twice would double-count one defect.

## Implementation deviations

- **Deterministic sample, not a reservoir sample.** The sketch says
  "reservoir-sample 30-50 URLs". The audit uses `sampleEntries` (even stride,
  deterministic, 6 URLs) so a re-scan probes the same URLs and two runs can be
  compared. A reservoir sample would make every result irreproducible.
- **The sitemap tree is walked once per scan** and shared with the other two
  sitemap-sampling audits (`siteSitemapTree`), and the sampled documents go
  through one per-scan cache (`fetchSampledPage`), so three audits reading the
  same URL cost one request between them.
- **Scanned pages are reused before any URL is fetched.** A sampled URL the
  orchestrator already fetched contributes its headers, JSON-LD and meta from
  `ctx.pages`; only the remainder costs a request, and each of those is
  `isSafeUrl`-gated.
- **`og:updated_time` is accepted as a fourth signal** alongside the three the
  sketch names. It costs nothing to read from the meta map the parser already
  built, and a page that publishes only that one is still verifiable.
- **Distribution entropy is not computed.** The sketch mentions "distribution
  entropy of lastmod values"; the falsifiable claim underneath it is the modal
  share, which is what the audit measures (modal value over 90% of the sample
  and within 3 days of the scan). An entropy number would have to be explained
  before it could be acted on, and would fire on shapes that are not defects.
- **One hour of clock skew is tolerated** before a value counts as
  future-dated, so a server a few minutes ahead of the scanner is not reported.

## Deferred

- **Only the first level of a `<sitemapindex>` is walked**, per the shared
  gatherer. A site whose freshness problem lives in a third-level child sitemap
  is sampled from the levels above it.
- **The 7-day divergence window is fixed.** A daily-publishing news site and a
  documentation set that changes quarterly are held to the same window; making
  it adaptive needs a publication-cadence estimate this audit does not build.
- **`Last-Modified` is taken at face value.** Many origins send the response
  time rather than the document time, which makes the header agree with almost
  any recent `lastmod`. The audit reports how many URLs were corroborated so
  the reader can weigh that, but it cannot tell a real document date from a
  synthesised one.
