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

Every scanned page must appear in at least one *discovery index*: the sitemap (including the sub-sitemaps a `<sitemapindex>` points at) or the llms.txt link list. A page in neither is reachable only through the link graph, which the non-JS-executing AI crawlers may not traverse.

| State | Result |
| :--- | :--- |
| every page found in an index | `pass` |
| >50% of pages found in no index | `fail`, priority `medium` |
| ≤50% of pages found in no index | `warn`, priority `low` |
| no sitemap URLs and no llms.txt links at all | `warn`, priority `medium` |
| no pages scanned | `na` |

Both sides of the comparison go through one key — host without `www.`, lower-cased decoded path, no trailing slash, no scheme, query or fragment — and a page also matches on its declared `<link rel="canonical">`.

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

**Grade: B** — Sitemaps are a stable, universally implemented de facto standard, and Google documents consuming them directly — "Google reads your sitemap regularly, so be sure to include all the content that you want Google to crawl" — which reaches AI Overviews and AI Mode through the same index. That is one documented consumer, not the AI vendors themselves: OpenAI's bots page, Anthropic's crawler article and Perplexity's documentation never mention sitemaps, and Google's own AI-features page insists there are "no additional technical requirements". Server logs showing GPTBot and ClaudeBot fetching `/sitemap.xml` are single-site reports. Well-established mechanism, weak AI-specific proof, is grade B.

**Evidence:** Sitemaps are a stable, universally-implemented de facto standard (protocol 0.9, 50k URLs / 50MB limits, robots.txt `Sitemap:` discovery). Google documents consuming them directly: 'Google reads your sitemap regularly, so be sure to include all the content that you want Google to crawl'. It also recommends <lastmod>. And Google's AI-features guidance makes AI Overviews and AI Mode eligibility conditional on ordinary Search indexing, so sitemap-driven discovery transitively feeds an AI surface. The same applies through Bing's index, which grounds Copilot. Vercel's crawl-waste data supplies an indirect argument: ChatGPT wastes 34.82% of fetches on 404s and Claude 34.16% (versus Googlebot's 8.22%), which is the signature of crawlers working from stale link graphs — precisely the failure a current sitemap with accurate lastmod mitigates.

**Counter-evidence:** No AI crawler vendor documents sitemap consumption. OpenAI's bots page, Anthropic's crawler article and Perplexity's docs never mention sitemaps, and Google's own AI-features page insists there are 'no additional technical requirements' for AI features. Server-log reports that GPTBot and ClaudeBot request /sitemap.xml exist but are single-site blog analyses, not controlled experiments — treat as suggestive only. The defensible framing is: sitemaps are proven for the Google/Bing indexes that ground several AI answer surfaces, and unproven-but-plausible for the direct AI crawlers. Note also that <lastmod> must be the page's real modification date, not the generation date, or the signal is actively misleading.

## Absorbed evidence — no-orphan-pages (1.22)

1.22 checked the same thing from the other side: scanned pages against sitemap `<loc>` values **plus llms.txt links**. That llms.txt half is what the fold carries over — a page listed only in llms.txt is indexed, and v1's 1.8 called it missing.

Its dossier is kept verbatim at [merged/machine-discovery/no-orphan-pages.md](../../merged/machine-discovery/no-orphan-pages.md) (grade **A**).

### Grade decision: stays **B**, the absorbed A does not transfer

1.22 was graded **A** on the signal *"internal linking depth and absence of orphan pages — every indexable page reachable via a crawlable `<a href>`"*. That is a claim about the **link graph**: Google's "Google can only crawl your link if it's an `<a>` HTML element with an href attribute", plus the Vercel/MERJ measurement that no major AI crawler executes JavaScript. The audit named after it never measured link reachability — it measured presence in the sitemap or llms.txt, which is this audit's own signal, graded **B** (sitemaps are proven for the Google/Bing indexes that ground AI answer surfaces, undocumented for the direct AI crawlers).

The meta law raises a target's grade only when the absorbed evidence is stronger *and proven for the merged signal*. The A evidence is proven for the link-graph signal, which now lives in `machine-discovery/in-content-links` (1.15 + 10.11) and `machine-discovery/no-broken-links` — not here. So the merged audit stays **B**, `tier: scored`, `weight 0.6`, and the A-graded orphan evidence is recorded above as context rather than priced in.

## Required fixes — landed 2026-08-22

Both source reviews' required fixes shipped with the fold:

- **No vacuous pass on a `<sitemapindex>`.** v1 returned `pass` on seeing an index without reading a single URL — a free pass for every Shopify/WordPress/Next.js site. Sub-sitemaps are now fetched (capped at 10) and their `<loc>` sets merged before comparing.
- **The Shopify filename heuristic is gone.** 1.22 guessed coverage from `path.startsWith('/products') && body.includes('sitemap_products')`, so Yoast (`post-sitemap.xml`), Next.js (`sitemap/0.xml`) and any localized path (`/produkte`, `/produits`) had *every* page reported as an orphan. Fetching the sub-sitemaps replaces the guess.
- **One normalizer on both sides.** `http`/`https`, `www.`/bare host, case, percent-encoding and tracking query params no longer produce phantom missing pages.
- **Canonical actually read.** v1's `page.meta['canonical']` was dead code (`extractMetaTags` reads `<meta>`, canonical is a `<link>`); the canonical is now read from `link[rel=canonical]`.
- **llms.txt relative links counted.** `extractMarkdownLinks` keeps absolute URLs only, so `- [About](/about)` made the llms.txt half of the comparison empty; links are now resolved against the base URL.
- **One penalty per missing file.** An absent sitemap used to fail here at priority `critical` on top of sitemap-exists (1.7); with no index of any kind the audit now warns.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources) on both source audits.
- 2026-08-21 — dispositions approved: 1.8 keep-with-fixes, 1.22 merge into it.
- 2026-08-22 — 1.22 folded in and both reviews' required fixes landed (Plan 4, Task 4); registry 173 → 172.
