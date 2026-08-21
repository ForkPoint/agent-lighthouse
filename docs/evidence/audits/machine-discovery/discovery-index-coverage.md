---
audit: machine-discovery/discovery-index-coverage
audit_id: "1.8"
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/discovery-index-coverage.ts
slug: discovery-index-coverage
review_verdict: fix
severity: high
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# sitemap-key-pages (`1.8`)

> content-discoverability · source `sitemap-key-pages.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

The sitemap should include all scanned pages so AI crawlers can discover your full site content.

## Code review findings (2026-08-20, 11-agent pass)

Compares scanned page URLs against sitemap <loc> values. Two disqualifying flaws: a sitemap index short-circuits to an unconditional PASS without checking a single URL (vacuous pass on the most common real configuration), and URL matching is raw string equality with only trailing-slash variants, so protocol/host/case/encoding differences produce phantom 'missing' pages. Compounded by circularity — the page list was largely seeded from this same sitemap.

**Required fix:** Fetch (cap ~10) sub-sitemaps when a <sitemapindex> is detected and merge their <loc> sets before comparing — never pass on the index alone. Replace raw string matching with a normalizer (lowercase host, strip default port, unify protocol, strip trailing slash and tracking query params, decodeURI the path) applied to both sides. Note the discovery circularity in the message, or restrict the comparison to nav-discovered pages so the result is not self-fulfilling.

**False-positive risks:**
- `if (isSitemapIndex) { … return this.pass('Sitemap index file found linking to N sub-sitemap(s)') }` — sub-sitemaps are never fetched. Every Shopify/WordPress/Next.js site with an index gets a free PASS on an audit that checked nothing. A site whose sub-sitemaps are empty or 404 also passes.
- `const variants = [pageUrl, pageUrl.replace(/\/$/, ''), pageUrl + '/']; variants.some((v) => sitemapUrls.has(v))` — exact string membership only. `http://` vs `https://`, `www.` vs bare host, `%20` vs `+`, uppercase path segments, and `?utm_source` query strings all yield false 'missing from sitemap'.
- Sitemap `<loc>` values are frequently XML-escaped (`&amp;` in query strings); cheerio's `.text()` unescapes, but the scanned page URL retains the browser-normalized form — another mismatch class.
- Denominator `ctx.pages.length` includes pages the orchestrator discovered *from* nav links only; conversely, pages discovered from the sitemap are guaranteed present. The ratio measures the discovery mix more than the sitemap's quality.
- 0.5 ratio boundary is arbitrary: 6/10 missing = FAIL, 5/10 missing = WARN, with no documented rationale.
- Sitemap body truncated at 5MB silently drops trailing `<loc>` entries → false 'missing' on large sites.

**Test gaps:**
- Sitemap index whose sub-sitemaps are empty or 404 (currently a false PASS)
- http vs https, www vs bare host, uppercase path, percent-encoding differences
- XML-escaped &amp; in <loc> query strings
- URLs with tracking query params
- Truncated (>5MB) sitemap body

**Overlaps with:** `1.22`, `1.7`

## Evidence

### Signal: sitemap.xml for AI crawler discovery — grade B (technical-infra)

**Mechanism:** A valid sitemap.xml referenced from robots.txt, with absolute URLs and accurate <lastmod>, increases the set of URLs that AI-feeding crawlers discover and the speed at which changed pages are re-fetched. FALSIFIABLE FORM: URLs present only in the sitemap (not reachable by internal links) are crawled by AI-feeding crawlers, and adding accurate lastmod shortens time-to-refetch after an edit.

**Evidence:** Sitemaps are a stable, universally-implemented de facto standard (protocol 0.9, 50k URLs / 50MB limits, robots.txt `Sitemap:` discovery). Google documents consuming them directly — 'Google reads your sitemap regularly, so be sure to include all the content that you want Google to crawl' and recommends <lastmod> — and Google's AI-features guidance makes AI Overviews / AI Mode eligibility conditional on ordinary Search indexing, so sitemap-driven discovery transitively feeds an AI surface. The same applies through Bing's index, which grounds Copilot. Vercel's crawl-waste data supplies an indirect argument: ChatGPT wastes 34.82% of fetches on 404s and Claude 34.16% (versus Googlebot's 8.22%), which is the signature of crawlers working from stale link graphs — precisely the failure a current sitemap with accurate lastmod mitigates.

**Counter-evidence:** No AI crawler vendor documents sitemap consumption. OpenAI's bots page, Anthropic's crawler article and Perplexity's docs never mention sitemaps, and Google's own AI-features page insists there are 'no additional technical requirements' for AI features. Server-log reports that GPTBot and ClaudeBot request /sitemap.xml exist but are single-site blog analyses, not controlled experiments — treat as suggestive only. The defensible framing is: sitemaps are proven for the Google/Bing indexes that ground several AI answer surfaces, and unproven-but-plausible for the direct AI crawlers. Note also that <lastmod> must be the page's real modification date, not the generation date, or the signal is actively misleading.
**Consumers:** Googlebot / Google AI Overviews & AI Mode, Bingbot / Microsoft Copilot grounding, GPTBot and ClaudeBot (observed in logs, undocumented) · **Recommended tier:** scored

**Sources:** [Sitemaps XML format (protocol 0.9)](https://www.sitemaps.org/protocol.html) · [Large site owner's guide to managing your crawl budget](https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget) · [AI features and your website — Google Search Central](https://developers.google.com/search/docs/appearance/ai-features) · [The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler) · [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) · [Perplexity Crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
