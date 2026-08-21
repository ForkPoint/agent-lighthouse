---
audit: content-discoverability/internal-linking
audit_id: "1.15"
category: content-discoverability
source_file: packages/core/src/audits/content-discoverability/internal-linking.ts
slug: internal-linking
review_verdict: fix
severity: medium
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# internal-linking (`1.15`)

> content-discoverability · source `internal-linking.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

A strong internal linking structure helps AI crawlers discover and understand the relationships between your pages.

## Code review findings (2026-08-20, 11-agent pass)

Counts internal anchors per page and fails only when a page has literally zero. Because same-page fragment links resolve to the page's own host, a lone 'skip to content' #main link satisfies the check — and every templated site has a nav and footer — so this audit passes essentially 100% of real sites and carries near-zero discriminating power. The guidance even prescribes '3-5 internal links per page', a threshold the code never enforces.

**Required fix:** Exclude same-page fragments (`resolved.href` equal to the page URL after stripping the hash) and exclude links inside <nav>/<footer> from the primary count so the metric reflects contextual linking. Enforce the threshold the guidance already states (warn below ~3 distinct internal destinations per page) instead of only failing at zero. Normalize www/bare-host before the internal test.

**False-positive risks:**
- `new URL(href, page.url)` resolves `#main`, `#content` and `javascript:`-adjacent fragments to the page's own URL, whose hostname matches the domain → counted as internal links. A page whose only anchor is an accessibility skip-link is graded as well-interlinked.
- Nav/footer links are counted identically to contextual body links, so the metric measures 'has a template' rather than 'has internal linking'. Combined with the zero-threshold rule, PASS is the near-universal outcome.
- `resolved.hostname === domain || resolved.hostname.endsWith('.'+domain)` with `domain = new URL(url).hostname`: scanning `https://www.example.com` while the markup links to bare `example.com` classifies every link as external → false FAIL 'No scanned pages have internal links'.
- SPA/client-routed sites that render navigation with onClick handlers or `<button>` elements have no `<a href>` in the SSR HTML → false FAIL, when agents using a headless browser would see the links.
- The catch-branch heuristic ('Relative URLs that fail to parse are likely internal') is nearly dead code — `new URL(href, page.url)` throws only when page.url itself is invalid — and the tests reach it only by artificially setting `page.url = ''`.
- Reported `avgLinks` is computed but never used in any threshold, so the 'avg N per page' figure influences nothing.

**Test gaps:**
- Page whose only anchor is '#main' (currently a false PASS)
- Nav/footer-only linking with no contextual body links
- www vs bare-host absolute internal links
- SPA with JS-routed navigation and no <a href>
- Verification that the 'avg 3-5 links' guidance corresponds to any code path

**Overlaps with:** `1.20`, `1.22`

## Evidence

### Signal: Internal linking depth and absence of orphan pages (every indexable page reachable via crawlable <a href>) — grade A (discovery-infra)

**Mechanism:** A page reachable only through JavaScript navigation, a button, or no internal link at all is not discovered by crawlers that parse HTML without executing scripts, so it never becomes eligible for AI citation; converting navigation to <a href> elements makes it discoverable. Falsifiable: if orphaned or JS-only-linked pages are indexed and cited at the same rate as linked pages, the claim fails.

**Evidence:** Google states the hard constraint verbatim: 'Google can only crawl your link if it's an <a> HTML element with an href attribute', and 'Google uses links as a signal when determining the relevancy of pages and to find new pages to crawl'. It enumerates the exact failure cases — <a> without href, <span href>, <a onclick>, javascript: hrefs. Apple independently lists 'Number and quality of links from other pages on the web' among the factors Apple Search takes into account when ranking web results. The empirical layer makes this sharper for LLM crawlers specifically: Vercel and MERJ found across roughly a billion requests that no major AI crawler executes JavaScript — GPTBot fetches JS files in 11.50% of requests and Claude in 23.84%, but neither executes them, while only Gemini and AppleBot render. A site whose navigation is client-side rendered is therefore a link-less void to GPTBot and ClaudeBot even though Googlebot copes. Google's own generative-AI guide closes the loop: 'The way Google Search finds and processes your pages remains the core of how our AI systems access your data.'

**Counter-evidence:** AI crawlers do not rely exclusively on the live link graph. Oncrawl's production log analysis documents ChatGPT crawling from model memory rather than links — 988 ChatGPT-User requests returning 404 on Boulanger.com within a few hours because the model invented product-listing paths, and OAI-SearchBot crawling non-existent pagination URLs with no corresponding site change. That means an unlinked page can still be hit if the model has memorized or hallucinated its URL, and conversely a well-linked page can be skipped. No AI vendor publishes its link-following policy. The specific quantitative claim that AI crawlers access orphaned legacy URLs at a rate '40% higher' than search bots comes from SEO gray literature with no reproducible methodology and should not be cited.
**Consumers:** Googlebot → AI Overviews / AI Mode, Applebot (links are an explicit Apple Search ranking factor), GPTBot / OAI-SearchBot, ClaudeBot, PerplexityBot (all non-JS-executing per Vercel measurement, therefore link-graph dependent) · **Recommended tier:** scored

**Sources:** [Make Your Links Crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) · [About Applebot](https://support.apple.com/en-us/119829) · [The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler) · [Google's Guide to Optimizing for Generative AI Features on Google Search](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) · [AI Features and Your Website](https://developers.google.com/search/docs/appearance/ai-features) · [What AI bots are really doing on your site (production server-log analysis)](https://www.oncrawl.com/ai/what-ai-bots-really-doing-your-site/)

### Signal: nofollow on internal links / meta robots nofollow suppressing AI crawler link traversal — grade A (discovery-infra)

**Mechanism:** A page-level <meta name="robots" content="nofollow"> (or 'none') stops documented AI-serving crawlers from following any link on that page; per-link rel="nofollow" is treated by Google as a hint that links 'will generally not be followed'. Applying either to internal navigation therefore reduces discovery of the linked pages. Falsifiable: if pages linked only from nofollowed internal links are crawled and indexed at the same rate as normally linked pages, the claim fails.

**Evidence:** Apple's current Applebot documentation is unambiguous and names the behavior directly: among supported robots meta directives it lists 'nofollow: Applebot won't follow any links on the page' and 'none: Applebot won't index, snippet, or follow links on the page'. Applebot also supports these via the X-Robots-Tag HTTP header, and falls back to Googlebot's robots.txt rules when Applebot is not named — so Google-targeted directives leak into Apple's AI-grounding crawl. Google's own link-qualification documentation states that links marked nofollow, sponsored or ugc 'will generally not be followed'. Since Google's AI features require the target page to be 'indexed and eligible to be shown in Google Search with a snippet', suppressing traversal to a page suppresses its AI eligibility by the same chain established in signal 1. Two major vendors documenting the consumer behavior in their own crawler docs is what grade A requires.

**Counter-evidence:** Two significant qualifications. First, Apple's documented nofollow is the PAGE-LEVEL meta robots directive, not per-link rel="nofollow" — most audits conflate these, and Apple's docs say nothing about the rel attribute on individual anchors. An audit that flags a single rel="nofollow" internal link cannot cite the Applebot page as support. Second, Google demoted nofollow from directive to hint in September 2019 and states plainly that 'the linked pages may be found through other means, such as sitemaps or links from other sites, and thus they may still be crawled' — so nofollow does not reliably prevent discovery even for Google. OpenAI, Anthropic and Perplexity documentation is entirely silent on nofollow, with no evidence GPTBot, ClaudeBot or PerplexityBot honors it in either form. Scope the audit to meta robots nofollow/none on indexable pages, and treat per-link rel=nofollow on internal navigation as a weaker informational finding.
**Consumers:** Applebot (explicitly documents nofollow and none directives), Googlebot → AI Overviews / AI Mode (nofollow/sponsored/ugc as hints) · **Recommended tier:** scored

**Sources:** [About Applebot](https://support.apple.com/en-us/119829) · [Qualify Your Outbound Links to Google (nofollow, sponsored, ugc)](https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links) · [AI Features and Your Website](https://developers.google.com/search/docs/appearance/ai-features) · [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) · [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518) · [Perplexity Crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
