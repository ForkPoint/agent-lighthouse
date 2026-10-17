---
audit: machine-discovery/sitemap-absolute-urls
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/sitemap-absolute-urls.ts
slug: sitemap-absolute-urls
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
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

# sitemap-absolute-urls (`1.9`)

> content-discoverability · source `sitemap-absolute-urls.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

Sitemap URLs must be absolute (starting with https://) so AI crawlers can resolve them without ambiguity.

## Evidence

### Signal: sitemap.xml for AI crawler discovery — grade B (technical-infra)

**Mechanism:** A valid sitemap.xml referenced from robots.txt, with absolute URLs and accurate <lastmod>, increases the set of URLs that AI-feeding crawlers discover and the speed at which changed pages are re-fetched. Falsifiable form: URLs present only in the sitemap (not reachable by internal links) are crawled by AI-feeding crawlers, and adding accurate lastmod shortens time-to-refetch after an edit.

**Grade: B** — Sitemaps are a stable, universally implemented de facto standard. Google documents consuming them directly: "Google reads your sitemap regularly, so be sure to include all the content that you want Google to crawl." That reaches AI Overviews and AI Mode through the same index. That is one documented consumer, not the AI vendors themselves: OpenAI's bots page, Anthropic's crawler article and Perplexity's documentation never mention sitemaps, and Google's own AI-features page insists there are "no additional technical requirements". Server logs showing GPTBot and ClaudeBot fetching `/sitemap.xml` are single-site reports. Well-established mechanism, weak AI-specific proof, is grade B.

**Evidence:** Sitemaps are a stable, universally-implemented de facto standard (protocol 0.9, 50k URLs / 50MB limits, robots.txt `Sitemap:` discovery). Google documents consuming them directly: 'Google reads your sitemap regularly, so be sure to include all the content that you want Google to crawl'. It also recommends <lastmod>. And Google's AI-features guidance makes AI Overviews and AI Mode eligibility conditional on ordinary Search indexing, so sitemap-driven discovery transitively feeds an AI surface. The same applies through Bing's index, which grounds Copilot. Vercel's crawl-waste data supplies an indirect argument. ChatGPT wastes 34.82% of fetches on 404s, and Claude 34.16%, against Googlebot's 8.22%. That is the signature of crawlers working from stale link graphs — precisely the failure a current sitemap with accurate lastmod mitigates.

**Counter-evidence:** No AI crawler vendor documents sitemap consumption. OpenAI's bots page, Anthropic's crawler article and Perplexity's docs never mention sitemaps, and Google's own AI-features page insists there are 'no additional technical requirements' for AI features. Server-log reports that GPTBot and ClaudeBot request /sitemap.xml exist but are single-site blog analyses, not controlled experiments — treat as suggestive only. The defensible framing is: sitemaps are proven for the Google/Bing indexes that ground several AI answer surfaces, and unproven-but-plausible for the direct AI crawlers. Note also that <lastmod> must be the page's real modification date, not the generation date, or the signal is actively misleading.

## Implementation deviations

- **Subpath sitemap scope.** On a subpath homepage, the shared sitemap gatherer
  treats that directory as the site root. A homepage served as `index.html` or
  as a `home` page (`/en/home/`) uses the directory that holds it (`/en/`).
  Robots.txt declarations come from the origin. The conventional sitemap names
  are tried under that directory before the origin fallbacks.
- **Only same-origin URLs under that directory are kept**, before the entry cap
  and sampling. Relative or malformed `loc` values in the site's own files are
  kept, so content audits can report them.
- **A sibling-only sitemap does not count** as this site's sitemap.
