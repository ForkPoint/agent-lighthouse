---
audit: machine-discovery/no-orphan-pages
audit_id: "1.22"
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/no-orphan-pages.ts
slug: no-orphan-pages
review_verdict: merge
severity: high
evidence_grade: A
disposition: "merge (approved 2026-08-21)"
reviewed: 2026-08-21
---

# no-orphan-pages (`1.22`)

> content-discoverability · source `no-orphan-pages.ts` · review verdict **merge** · evidence grade **A** · disposition: **merge (approved 2026-08-21)**

## What it checks

Orphan pages are not listed in your sitemap or llms.txt, so AI crawlers may never discover them.

## Code review findings (2026-08-20, 11-agent pass)

Checks scanned pages against sitemap <loc> values plus llms.txt links — the same underlying signal as 1.8, with llms.txt added. It carries the category's worst false-positive generator: a hardcoded Shopify-only sub-sitemap heuristic. Any site whose /sitemap.xml is an index using a different naming scheme (Yoast's post-sitemap.xml, custom generators) or non-English URL paths has EVERY scanned page reported as an orphan, while its pages are all in sub-sitemaps that the audit never fetches.

**Required fix:** Merge into 1.8 as a single 'scanned pages are covered by a discovery index' audit sharing one normalizer and one sitemap resolver. Replace the Shopify string heuristic with actually fetching (capped) sub-sitemaps from the index. Delete the dead `page.meta['canonical']` lookup and read the canonical from `page.$('link[rel=canonical]')` instead. Normalize both sides (host, scheme, case, encoding, trailing slash). Exclude sitemap-seeded pages from the orphan denominator so the result is not self-fulfilling.

**False-positive risks:**

- The sitemap-index workaround is `(path.startsWith('/products') && body.includes('sitemap_products')) || … '/collections' … '/blogs' …` — literal Shopify path and filename conventions. Yoast (`post-sitemap.xml`, `page-sitemap.xml`), Next.js (`sitemap/0.xml`), and any localized path (`/produkte`, `/produits`, `/productos`) miss entirely → mass false 'orphan' verdicts on valid sites. Sub-sitemaps are never fetched.
- `page.meta['canonical']` is dead code — canonical is a `<link>` element, and `extractMetaTags()` only reads `<meta>`, so this key is never populated. The intended canonical-based fallback matching silently never runs.
- URL matching is raw `Set.has()` over trailing-slash variants only; http/https, www/bare host, case, and percent-encoding differences produce phantom orphans (same class of bug as 1.8).
- Relative links in llms.txt are dropped upstream by `extractMarkdownLinks()`, so the llms.txt half of the comparison is empty for any site using relative links — inflating the orphan count.
- The selector `$('url > loc, sitemap > loc, loc')` makes the first two clauses redundant and pulls in `<loc>` from any context, including extension namespaces.
- Circular by construction: the orchestrator seeded the page list FROM the sitemap and llms.txt, so pages can essentially only be 'orphans' if they were nav-discovered — the audit is largely measuring its own discovery mix.
- When both sources are empty it warns 'No sitemap or llms.txt links to compare against', duplicating 1.7's finding as a second penalty.

**Test gaps:**

- Sitemap index with non-Shopify sub-sitemap names (Yoast/Next.js) — the dominant false-positive path, untested
- Non-English URL paths under a sitemap index
- Any test proving page.meta['canonical'] is populated (it never is)
- llms.txt with relative links
- http/https, www/bare-host, case and encoding mismatches
- Pages discovered from nav only vs seeded from the sitemap

**Overlaps with:** `1.8`, `1.7`

## Evidence

### Signal: Internal linking depth and absence of orphan pages (every indexable page reachable via crawlable <a href>) — grade A (discovery-infra)

**Mechanism:** A page reachable only through JavaScript navigation, a button, or no internal link at all is not discovered by crawlers that parse HTML without executing scripts, so it never becomes eligible for AI citation; converting navigation to <a href> elements makes it discoverable. Falsifiable: if orphaned or JS-only-linked pages are indexed and cited at the same rate as linked pages, the claim fails.

**Evidence:** Google states the hard constraint verbatim: 'Google can only crawl your link if it's an <a> HTML element with an href attribute', and 'Google uses links as a signal when determining the relevancy of pages and to find new pages to crawl'. It enumerates the exact failure cases — <a> without href, <span href>, <a onclick>, javascript: hrefs. Apple independently lists 'Number and quality of links from other pages on the web' among the factors Apple Search takes into account when ranking web results. The empirical layer makes this sharper for LLM crawlers specifically: Vercel and MERJ found across roughly a billion requests that no major AI crawler executes JavaScript — GPTBot fetches JS files in 11.50% of requests and Claude in 23.84%, but neither executes them, while only Gemini and AppleBot render. A site whose navigation is client-side rendered is therefore a link-less void to GPTBot and ClaudeBot even though Googlebot copes. Google's own generative-AI guide closes the loop: 'The way Google Search finds and processes your pages remains the core of how our AI systems access your data.'

**Counter-evidence:** AI crawlers do not rely exclusively on the live link graph. Oncrawl's production log analysis documents ChatGPT crawling from model memory rather than links — 988 ChatGPT-User requests returning 404 on Boulanger.com within a few hours because the model invented product-listing paths, and OAI-SearchBot crawling non-existent pagination URLs with no corresponding site change. That means an unlinked page can still be hit if the model has memorized or hallucinated its URL, and conversely a well-linked page can be skipped. No AI vendor publishes its link-following policy. The specific quantitative claim that AI crawlers access orphaned legacy URLs at a rate '40% higher' than search bots comes from SEO gray literature with no reproducible methodology and should not be cited.
**Consumers:** Googlebot → AI Overviews / AI Mode, Applebot (links are an explicit Apple Search ranking factor), GPTBot / OAI-SearchBot, ClaudeBot, PerplexityBot (all non-JS-executing per Vercel measurement, therefore link-graph dependent) · **Recommended tier:** scored

**Sources:** [Make Your Links Crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) · [About Applebot](https://support.apple.com/en-us/119829) · [The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler) · [Google's Guide to Optimizing for Generative AI Features on Google Search](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) · [AI Features and Your Website](https://developers.google.com/search/docs/appearance/ai-features) · [What AI bots are really doing on your site (production server-log analysis)](https://www.oncrawl.com/ai/what-ai-bots-really-doing-your-site/)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

**Merged into:** `machine-discovery/discovery-index-coverage` (Plan 4, 2026-08-22) — [merged dossier](../../audits/machine-discovery/discovery-index-coverage.md)
