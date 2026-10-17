---
audit: machine-discovery/discovery-index-coverage
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/discovery-index-coverage.ts
slug: discovery-index-coverage
evidence_grade: B
disposition: "merged 2026-08-22 (Plan 4, Task 4) — absorbs no-orphan-pages (1.22)"
reviewed: 2026-08-22
recommended_tier: scored
consumers:
  - "Googlebot / Google AI Overviews & AI Mode"
  - Bingbot / Microsoft Copilot grounding
  - "GPTBot and ClaudeBot (observed in logs, undocumented)"
signals:
  - name: sitemap.xml for AI crawler discovery
    grade: B
    domain: technical-infra
sources:
  - sitemaps-protocol
  - google-crawl-budget-docs
  - google-ai-features-trust
  - vercel-rise-of-ai-crawler
  - s18
  - perplexity-crawlers-docs
---

# discovery-index-coverage (`1.8`, `1.22`)

> machine-discovery · source `discovery-index-coverage.ts` · absorbs no-orphan-pages (1.22) · evidence grade **B** · tier **scored** (weight 0.6)

## What it checks

Every scanned page must appear in at least one _discovery index_: the sitemap (including the sub-sitemaps a `<sitemapindex>` points at) or the llms.txt link list. A page in neither is reachable only through the link graph, which the non-JS-executing AI crawlers may not traverse.

| State                                                        | Result                    |
| :----------------------------------------------------------- | :------------------------ |
| every page found in an index                                 | `pass`                    |
| >50% of pages found in no index                              | `fail`, priority `medium` |
| ≤50% of pages found in no index                              | `warn`, priority `low`    |
| no sitemap URLs and no llms.txt links at all                 | `warn`, priority `medium` |
| a page is missing, but the sitemap walk stopped at its limit | `na`                      |
| no pages scanned                                             | `na`                      |

Both sides of the comparison go through one key — host without `www.`, lower-cased decoded path, no trailing slash, no scheme, query or fragment — and a page also matches on its declared `<link rel="canonical">`.

## Evidence

### Signal: sitemap.xml for AI crawler discovery — grade B (technical-infra)

**Mechanism:** A valid sitemap.xml referenced from robots.txt, with absolute URLs and accurate <lastmod>, increases the set of URLs that AI-feeding crawlers discover and the speed at which changed pages are re-fetched. Falsifiable form: URLs present only in the sitemap (not reachable by internal links) are crawled by AI-feeding crawlers, and adding accurate lastmod shortens time-to-refetch after an edit.

**Grade: B** — Sitemaps are a stable, universally implemented de facto standard. Google documents consuming them directly: "Google reads your sitemap regularly, so be sure to include all the content that you want Google to crawl." That reaches AI Overviews and AI Mode through the same index. That is one documented consumer, not the AI vendors themselves: OpenAI's bots page, Anthropic's crawler article and Perplexity's documentation never mention sitemaps, and Google's own AI-features page insists there are "no additional technical requirements". Server logs showing GPTBot and ClaudeBot fetching `/sitemap.xml` are single-site reports. Well-established mechanism, weak AI-specific proof, is grade B.

**Evidence:** Sitemaps are a stable, universally-implemented de facto standard (protocol 0.9, 50k URLs / 50MB limits, robots.txt `Sitemap:` discovery). Google documents consuming them directly: 'Google reads your sitemap regularly, so be sure to include all the content that you want Google to crawl'. It also recommends <lastmod>. And Google's AI-features guidance makes AI Overviews and AI Mode eligibility conditional on ordinary Search indexing, so sitemap-driven discovery transitively feeds an AI surface. The same applies through Bing's index, which grounds Copilot. Vercel's crawl-waste data supplies an indirect argument. ChatGPT wastes 34.82% of fetches on 404s, and Claude 34.16%, against Googlebot's 8.22%. That is the signature of crawlers working from stale link graphs — precisely the failure a current sitemap with accurate lastmod mitigates.

**Counter-evidence:** No AI crawler vendor documents sitemap consumption. OpenAI's bots page, Anthropic's crawler article and Perplexity's docs never mention sitemaps, and Google's own AI-features page insists there are 'no additional technical requirements' for AI features. Server-log reports that GPTBot and ClaudeBot request /sitemap.xml exist but are single-site blog analyses, not controlled experiments — treat as suggestive only. The defensible framing is: sitemaps are proven for the Google/Bing indexes that ground several AI answer surfaces, and unproven-but-plausible for the direct AI crawlers. Note also that <lastmod> must be the page's real modification date, not the generation date, or the signal is actively misleading.

## Implementation deviations

- **Absorbs `no-orphan-pages` (1.22).** Its dossier is kept at
  [merged/machine-discovery/no-orphan-pages.md](../../merged/machine-discovery/no-orphan-pages.md).
  The llms.txt half of the comparison comes from it.
- **The grade stays B.** The absorbed A was earned for link-graph
  reachability, which `in-content-links` and `no-broken-links` measure. This
  audit measures index presence.
- **Relative llms.txt links count.** They resolve against the base URL.
- **Subpath sitemap scope.** On a subpath homepage, the shared sitemap gatherer
  keeps only same-origin URLs under that directory.
- **A partial sitemap read declines the verdict.** The walk keeps at most 500
  entries and 10 child sitemaps. When it stops early, or a child is unread,
  failed, malformed or a nested index, a missing page returns `na`. A page found
  in the partial read still passes.

## Deferred

- The fetcher cuts a sitemap body at 5 MB and does not flag the cut. A `<loc>` lost to that cut is still read as absent. The walk needs a body-truncation flag before this audit can decline that case too.
- After the entry cap is reached, the walk still downloads the remaining child sitemaps and discards their entries.
