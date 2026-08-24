---
audit: machine-discovery/sitemap-absolute-urls
audit_id: "1.9"
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/sitemap-absolute-urls.ts
slug: sitemap-absolute-urls
review_verdict: fix
severity: high
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# sitemap-absolute-urls (`1.9`)

> content-discoverability · source `sitemap-absolute-urls.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

Sitemap URLs must be absolute (starting with https://) so AI crawlers can resolve them without ambiguity.

## Code review findings (2026-08-20, 11-agent pass)

Flags <loc> values not starting with http:// or https://. The rule itself is correct per sitemaps.org, but the audit reads `$('url > loc')` and so reports a hard FAIL — 'Sitemap has no <loc> entries to check' — on every valid <sitemapindex>, where the entries are `<sitemap><loc>`. That is a wrong verdict on one of the most common real-world sitemap shapes, with no way for the user to act on it.

**Required fix:** Use the shared sitemap resolver from the 1.8 fix so an index is expanded to its sub-sitemaps' <url> entries before checking. Return notApplicable() (not fail) when there are genuinely no <url> entries — that is 1.7's finding, not this audit's. Make the scheme test case-insensitive (`/^https?:\/\//i`) and report protocol-relative URLs as their own distinct sub-case.

**False-positive risks:**
- `$('url > loc')` only. On a `<sitemapindex>` this returns 0 → `locs.length === 0` → FAIL at high priority: 'Sitemap has no <loc> entries to check.' Shopify, Yoast and Next.js multi-sitemap setups all hit this.
- Same failure on a `<urlset>` served gzipped (undici does not decompress) or truncated below the first `<url>` element.
- `!loc.startsWith('http://') && !loc.startsWith('https://')` is case-sensitive. `HTTPS://example.com/page` — legal per RFC 3986 scheme case-insensitivity — is reported as a relative URL.
- Protocol-relative `//example.com/page` is grouped with true relatives, though it is a distinct (and differently-fixed) problem.
- An HTML soft-404 at /sitemap.xml yields FAIL 'no <loc> entries' rather than 'no sitemap'.

**Test gaps:**
- <sitemapindex> input — currently produces a wrong FAIL and is completely untested
- Uppercase HTTPS:// scheme
- Protocol-relative //host/path
- Gzipped body
- HTML soft-404 at the sitemap path

**Overlaps with:** `1.7`, `1.8`, `1.10`

## Evidence

### Signal: sitemap.xml for AI crawler discovery — grade B (technical-infra)

**Mechanism:** A valid sitemap.xml referenced from robots.txt, with absolute URLs and accurate <lastmod>, increases the set of URLs that AI-feeding crawlers discover and the speed at which changed pages are re-fetched. FALSIFIABLE FORM: URLs present only in the sitemap (not reachable by internal links) are crawled by AI-feeding crawlers, and adding accurate lastmod shortens time-to-refetch after an edit.

**Evidence:** Sitemaps are a stable, universally-implemented de facto standard (protocol 0.9, 50k URLs / 50MB limits, robots.txt `Sitemap:` discovery). Google documents consuming them directly — 'Google reads your sitemap regularly, so be sure to include all the content that you want Google to crawl' and recommends <lastmod> — and Google's AI-features guidance makes AI Overviews / AI Mode eligibility conditional on ordinary Search indexing, so sitemap-driven discovery transitively feeds an AI surface. The same applies through Bing's index, which grounds Copilot. Vercel's crawl-waste data supplies an indirect argument: ChatGPT wastes 34.82% of fetches on 404s and Claude 34.16% (versus Googlebot's 8.22%), which is the signature of crawlers working from stale link graphs — precisely the failure a current sitemap with accurate lastmod mitigates.

**Counter-evidence:** No AI crawler vendor documents sitemap consumption. OpenAI's bots page, Anthropic's crawler article and Perplexity's docs never mention sitemaps, and Google's own AI-features page insists there are 'no additional technical requirements' for AI features. Server-log reports that GPTBot and ClaudeBot request /sitemap.xml exist but are single-site blog analyses, not controlled experiments — treat as suggestive only. The defensible framing is: sitemaps are proven for the Google/Bing indexes that ground several AI answer surfaces, and unproven-but-plausible for the direct AI crawlers. Note also that <lastmod> must be the page's real modification date, not the generation date, or the signal is actively misleading.
**Consumers:** Googlebot / Google AI Overviews & AI Mode, Bingbot / Microsoft Copilot grounding, GPTBot and ClaudeBot (observed in logs, undocumented) · **Recommended tier:** scored

**Sources:** [Sitemaps XML format (protocol 0.9)](https://www.sitemaps.org/protocol.html) (verified 2026-08-20) · [Large site owner's guide to managing your crawl budget](https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget) (verified 2026-08-20) · [AI features and your website — Google Search Central](https://developers.google.com/search/docs/appearance/ai-features) (verified 2026-08-20) · [The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler) (verified 2026-08-20) · [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) (verified 2026-08-20) · [Perplexity Crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers) (verified 2026-08-20)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
