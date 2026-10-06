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

## Competitor coverage

Screaming Frog, Sitebulb, Semrush and Ahrefs surface lastmod presence and can flag future dates, but none cross-validate lastmod against on-page JSON-LD dateModified / article:modified_time / Last-Modified, and none detect the build-stamp entropy collapse. Lighthouse's agentic category does not crawl sitemaps at all.

## Implementation sketch

1. Fetch robots.txt Sitemap: directives plus /sitemap.xml, /sitemap_index.xml; recurse <sitemapindex> one level. 2) Validate each lastmod parses as W3C Datetime (YYYY-MM-DD or full RFC3339); count malformed. 3) Reservoir-sample 30-50 URLs across all child sitemaps. 4) For each: GET, capture the Last-Modified response header; parse all JSON-LD blocks for dateModified/datePublished; parse <meta property="article:modified_time"> and <meta name="last-modified">. 5) Per URL compute min absolute delta between sitemap lastmod and any available page signal. 6) Report: %future-dated (FAIL if >0), %malformed, the largest cluster within a one-hour window (build-stamp context only when it covers >90% of sampled URLs, falls within 3 days of the crawl date, and the page-date divergence threshold is exceeded), and %URLs whose delta exceeds 7 days against every available signal (FAIL if >20%). 7) Report separately the %URLs with no page-level signal at all — that is an actionable sub-finding (add dateModified to JSON-LD) rather than a lastmod failure.

## Example failure

A Hugo site regenerates every page on each deploy, so sitemap.xml lists 4,000 URLs all with lastmod=2026-08-19T04:11:00Z. The JSON-LD dateModified on those pages ranges from 2019 to 2026. Google and every pull crawler downweight the sitemap's lastmod entirely. A genuinely revised pricing page published 2026-08-18 therefore gets no priority over 4,000 unchanged archive pages, and is re-fetched weeks later. Meanwhile the site owner's SEO tool reports '100% of URLs have lastmod' as a pass.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Not a duplicate of `machine-discovery/sitemap-lastmod`

The two audits ask different questions and must not be collapsed into one:

| Audit                                             | Question                  | Fails when                                                                                                          |
| ------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `machine-discovery/sitemap-lastmod`               | Is `lastmod` **present**? | The sitemap omits it, or omits it on most URLs.                                                                     |
| `machine-discovery/sitemap-lastmod-verifiability` | Is `lastmod` **true**?    | The values that exist contradict the pages, are future-dated, or repeat a deploy stamp that contradicts page dates. |

A sitemap can pass the first and fail this one, which is the common case: the
CMS emits `lastmod` on every URL and rewrites all of them on every build.
Absence is `notApplicable` here, never a failure — with no values there is
nothing to verify, and reporting it twice would double-count one defect.

## Implementation deviations

### Subpath sitemap scope (2026-10-05)

The shared sitemap gatherer uses the scanned homepage directory as the site root when it is a detected or declared subpath homepage. It reads declarations from the origin's robots.txt, then tries the conventional sitemap names under that directory before the origin fallbacks. Shared sitemap files contribute only absolute URLs on the same origin and under that directory. Filtering precedes the entry cap and sampling. Relative or malformed loc values associated with this site remain available to content audits. A sibling-only sitemap does not prove that this site has a sitemap. The child-fetch cap remains in force even when all children cover siblings.

Content-page scans do not infer a mount. Origin files, origin probes, feed discovery, explicit page overrides, and redirect handling keep their existing scope. This change limits sitemap-derived evidence; it does not make every scan request subpath-only.

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

### Page signals exclude contributed dates (2026-10-06)

The sketch says to parse all JSON-LD blocks for `dateModified` and `datePublished`. The audit reads those dates only from nodes that describe the page: top-level nodes, `@graph` members and what they nest. It skips a nested `Review`, `Comment`, `Answer` or `Question`. Those dates record when someone else wrote, not when the page changed. A top-level `Review` is the page itself and keeps its dates.

The trigger was a large retail site. Its product pages publish no modification time, but each one nests customer reviews. The review dates were read as page signals, and five pages with no page date were reported as divergent. They are now unverifiable.

### A build stamp is one run, not one string (2026-10-06)

The claim is "one identical lastmod equal to the last deploy date". The audit compared lastmod strings exactly. A generator that writes the clock per URL spreads one run over seconds, and exact matching saw every value as different. One large retail site stamped 2451 product URLs between 09:57:16 and 09:57:33 on one day. The audit now counts the largest group of sampled values inside a one-hour window. The 90% share and the 3-day recency rules are unchanged. Values hours apart still count as separate dates. The correction below limits how this pattern affects the verdict.

### `Last-Modified` corroborates but cannot contradict (2026-10-06)

Step 5 of the sketch takes the minimum delta against any page signal, the
HTTP `Last-Modified` header included. On a static host the header is the
file's write time, so every deploy moves it. A small marketing site stamps its
legal pages' `lastmod` from their editorial dates and publishes no
`dateModified`. Its server sent the deploy day as `Last-Modified`, and the
audit failed the correct editorial dates as divergent. The audit's own fix
text tells sites to do exactly what that site did: stamp lastmod from the
content record and leave it alone on a rebuild.

The header still corroborates: a `lastmod` within seven days of it counts as
verified. A URL whose only signal is the header, and which disagrees with it,
now counts as unverifiable rather than divergent. A URL with a JSON-LD date or
an article meta date is judged as before, against every signal it has.

No corpus or bare-site verdict moved: the corpus fixtures carry no sitemap.

### A date cluster needs contradictory evidence (2026-10-06)

Six real edits within 25 minutes can each agree exactly with the page's
`dateModified`. The one-hour rule previously failed that fully corroborated
sample as a build stamp. A cluster now adds build-stamp context only when
more than 20% of comparable page dates also diverge by over seven days.
A corroborated batch passes. Missing page dates keep the existing
unverifiable warning and never prove a build stamp. Future dates and
contradictory content dates still fail. This corrects the implementation
sketch against the existing source requirement: the timestamp must describe
the significant content update, not follow any required publication cadence.

### A deploy-time header cannot vouch for a stamp run (2026-10-06)

The cluster rule above left one gap. A static host can write every
`lastmod` at build time and send the deploy time as `Last-Modified`. The two
agree to within minutes, so every URL counted as corroborated and the audit
passed. That agreement shows when the build ran, not when the content
changed.

When the sample has the stamp shape — over 90% in one recent one-hour run —
the header is no longer compared. Content dates still corroborate or
contradict as before. A URL with only the header becomes unverifiable, so
the site gets the existing warning, not a pass and not a fail. Outside that
shape the header corroborates exactly as before.

## Deferred

- **Only the first level of a `<sitemapindex>` is walked**, per the shared
  gatherer. A site whose freshness problem lives in a third-level child sitemap
  is sampled from the levels above it.
- **The 7-day divergence window is fixed.** A daily-publishing news site and a
  documentation set that changes quarterly are held to the same window; making
  it adaptive needs a publication-cadence estimate this audit does not build.
- **`Last-Modified` corroboration is taken at face value.** Many origins send
  the response time rather than the document time, which makes the header agree
  with almost any recent `lastmod`. The audit reports how many URLs were corroborated so
  the reader can weigh that, but it cannot tell a real document date from a
  synthesised one.
