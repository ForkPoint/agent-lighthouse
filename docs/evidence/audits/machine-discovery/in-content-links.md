---
audit: machine-discovery/in-content-links
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/in-content-links.ts
slug: in-content-links
evidence_grade: A
disposition: "rewritten + merged 2026-08-22 (Plan 4, Task 4) — absorbs internal-cross-linking (10.11)"
reviewed: 2026-08-22
recommended_tier: scored
consumers:
  - Applebot (explicitly documents nofollow and none directives)
  - Googlebot → AI Overviews / AI Mode (nofollow/sponsored/ugc as hints)
signals:
  - name: "Internal linking depth and absence of orphan pages (every indexable page reachable via crawlable <a href>)"
    grade: A
    domain: discovery-infra
  - name: nofollow on internal links / meta robots nofollow suppressing AI crawler link traversal
    grade: A
    domain: discovery-infra
sources:
  - google-links-crawlable
  - applebot-doc
  - vercel-rise-of-ai-crawler
  - google-ai-optimization-mythbusting
  - google-ai-features-trust
  - oncrawl-ai-bot-logs
  - google-rel-ugc
  - s18
  - anthropic-crawler-docs
  - perplexity-crawlers-docs
---

# in-content-links (`1.15`, `10.11`)

> machine-discovery · source `in-content-links.ts` · rewritten, absorbs internal-cross-linking (10.11) · evidence grade **A** · tier **scored** (weight 1.0)

## What it checks

Distinct internal destinations linked **from the page's own content** — anchors inside `<main>`/`<article>` (or the body when neither exists), minus anything under `nav`, `header`, `footer`, `aside` or the equivalent ARIA roles.

A destination is counted once per page, keyed on host-without-`www` plus lower-cased path with no trailing slash, query or fragment. Same-page fragments, self-links, the site root and `/…/page/N` pagination do not count, and non-HTTP schemes (`mailto:`, `tel:`, `javascript:`) are ignored.

| State                                               | Result                    |
| :-------------------------------------------------- | :------------------------ |
| every page has ≥ 2 distinct in-content destinations | `pass`                    |
| some pages below the bar                            | `warn`, priority `low`    |
| _no_ page has a single in-content internal link     | `fail`, priority `medium` |
| no pages scanned                                    | `na`                      |

## Evidence

### Signal: Internal linking depth and absence of orphan pages (every indexable page reachable via crawlable <a href>) — grade A (discovery-infra)

**Mechanism:** A page may be reachable only through JavaScript navigation, a button, or no internal link at all. Crawlers that parse HTML without executing scripts do not discover it, so it never becomes eligible for AI citation. Converting navigation to <a href> elements makes it discoverable. Falsifiable: if orphaned or JS-only-linked pages are indexed and cited at the same rate as linked pages, the claim fails.

**Grade: A** — Google states the constraint verbatim — "Google can only crawl your link if it's an `<a>` HTML element with an `href` attribute" — and enumerates the exact failures: `<a>` without `href`, `<span href>`, `<a onclick>`, `javascript:` hrefs. A vendor stating a hard requirement, with the failing forms listed, is the grade-A bar. The audit does not extend that to a claim that unlinked pages are unreachable: Oncrawl's production logs show ChatGPT fetching from model memory rather than the link graph, including 988 requests returning 404 for paths the model invented. Links are the documented discovery route, not the only one.

**Evidence:** Google states the hard constraint verbatim: 'Google can only crawl your link if it's an <a> HTML element with an href attribute'. It adds that 'Google uses links as a signal when determining the relevancy of pages and to find new pages to crawl'. It enumerates the exact failure cases — <a> without href, <span href>, <a onclick>, javascript: hrefs. Apple independently lists 'Number and quality of links from other pages on the web' among the factors Apple Search takes into account when ranking web results. The empirical layer makes this sharper for LLM crawlers specifically. Across roughly a billion requests, Vercel and MERJ found that no major AI crawler executes JavaScript. GPTBot fetches JS files in 11.50% of requests and Claude in 23.84%, but neither executes them. Only Gemini and AppleBot render. A site whose navigation is client-side rendered is therefore a link-less void to GPTBot and ClaudeBot even though Googlebot copes. Google's own generative-AI guide closes the loop: 'The way Google Search finds and processes your pages remains the core of how our AI systems access your data.'

**Counter-evidence:** AI crawlers do not rely exclusively on the live link graph. Oncrawl's production log analysis documents ChatGPT crawling from model memory rather than links. 988 ChatGPT-User requests returned 404 on Boulanger.com within a few hours, because the model invented product-listing paths. OAI-SearchBot crawled non-existent pagination URLs, with no corresponding site change. That means an unlinked page can still be hit if the model has memorized or hallucinated its URL, and conversely a well-linked page can be skipped. No AI vendor publishes its link-following policy. The specific quantitative claim that AI crawlers access orphaned legacy URLs at a rate '40% higher' than search bots comes from SEO gray literature with no reproducible methodology and should not be cited.

### Signal: nofollow on internal links / meta robots nofollow suppressing AI crawler link traversal — grade A (discovery-infra)

**Mechanism:** A page-level <meta name="robots" content="nofollow"> (or 'none') stops documented AI-serving crawlers from following any link on that page; per-link rel="nofollow" is treated by Google as a hint that links 'will generally not be followed'. Applying either to internal navigation therefore reduces discovery of the linked pages. Falsifiable: if pages linked only from nofollowed internal links are crawled and indexed at the same rate as normally linked pages, the claim fails.

**Evidence:** Apple's current Applebot documentation is unambiguous and names the behavior directly: among supported robots meta directives it lists 'nofollow: Applebot won't follow any links on the page' and 'none: Applebot won't index, snippet, or follow links on the page'. Applebot also supports these via the X-Robots-Tag HTTP header, and falls back to Googlebot's robots.txt rules when Applebot is not named — so Google-targeted directives leak into Apple's AI-grounding crawl. Google's own link-qualification documentation states that links marked nofollow, sponsored or ugc 'will generally not be followed'. Since Google's AI features require the target page to be 'indexed and eligible to be shown in Google Search with a snippet', suppressing traversal to a page suppresses its AI eligibility by the same chain established in signal 1. Two major vendors documenting the consumer behavior in their own crawler docs is what grade A requires.

**Counter-evidence:** Two significant qualifications. First, Apple's documented nofollow is the PAGE-LEVEL meta robots directive, not per-link rel="nofollow" — most audits conflate these, and Apple's docs say nothing about the rel attribute on individual anchors. An audit that flags a single rel="nofollow" internal link cannot cite the Applebot page as support. Second, Google demoted nofollow from directive to hint in September 2019. It states plainly that 'the linked pages may be found through other means, such as sitemaps or links from other sites, and thus they may still be crawled'. So nofollow does not reliably prevent discovery even for Google. OpenAI, Anthropic and Perplexity documentation is entirely silent on nofollow, with no evidence GPTBot, ClaudeBot or PerplexityBot honors it in either form. Scope the audit to meta robots nofollow/none on indexable pages, and treat per-link rel=nofollow on internal navigation as a weaker informational finding.

## Implementation deviations

- **Absorbs `internal-cross-linking` (10.11).** Its dossier is kept at
  [merged/machine-discovery/internal-cross-linking.md](../../merged/machine-discovery/internal-cross-linking.md).
  Its B evidence is weaker, so the grade stays A.
- **A page with no server-rendered in-content links is a true finding.** The
  evidence says the major AI crawlers do not execute JavaScript. The site-wide
  `fail` still needs every scanned page to be linkless.
- **`nofollow` is not read.** Page-level meta robots and per-link `rel` are
  different mechanisms, and Google treats `rel=nofollow` as a hint. That
  belongs in a dedicated check, not a link count.
