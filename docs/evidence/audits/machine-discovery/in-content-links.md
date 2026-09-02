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

**Mechanism:** A page may be reachable only through JavaScript navigation, a button, or no internal link at all. Crawlers that parse HTML without executing scripts do not discover it, so it never becomes eligible for AI citation. Converting navigation to <a href> elements makes it discoverable. Falsifiable: if orphaned or JS-only-linked pages are indexed and cited at the same rate as linked pages, the claim fails.

**Grade: A** — Google states the constraint verbatim — "Google can only crawl your link if it's an `<a>` HTML element with an `href` attribute" — and enumerates the exact failures: `<a>` without `href`, `<span href>`, `<a onclick>`, `javascript:` hrefs. A vendor stating a hard requirement, with the failing forms listed, is the grade-A bar. The audit does not extend that to a claim that unlinked pages are unreachable: Oncrawl's production logs show ChatGPT fetching from model memory rather than the link graph, including 988 requests returning 404 for paths the model invented. Links are the documented discovery route, not the only one.

**Evidence:** Google states the hard constraint verbatim: 'Google can only crawl your link if it's an <a> HTML element with an href attribute'. It adds that 'Google uses links as a signal when determining the relevancy of pages and to find new pages to crawl'. It enumerates the exact failure cases — <a> without href, <span href>, <a onclick>, javascript: hrefs. Apple independently lists 'Number and quality of links from other pages on the web' among the factors Apple Search takes into account when ranking web results. The empirical layer makes this sharper for LLM crawlers specifically. Across roughly a billion requests, Vercel and MERJ found that no major AI crawler executes JavaScript. GPTBot fetches JS files in 11.50% of requests and Claude in 23.84%, but neither executes them. Only Gemini and AppleBot render. A site whose navigation is client-side rendered is therefore a link-less void to GPTBot and ClaudeBot even though Googlebot copes. Google's own generative-AI guide closes the loop: 'The way Google Search finds and processes your pages remains the core of how our AI systems access your data.'

**Counter-evidence:** AI crawlers do not rely exclusively on the live link graph. Oncrawl's production log analysis documents ChatGPT crawling from model memory rather than links. 988 ChatGPT-User requests returned 404 on Boulanger.com within a few hours, because the model invented product-listing paths. OAI-SearchBot crawled non-existent pagination URLs, with no corresponding site change. That means an unlinked page can still be hit if the model has memorized or hallucinated its URL, and conversely a well-linked page can be skipped. No AI vendor publishes its link-following policy. The specific quantitative claim that AI crawlers access orphaned legacy URLs at a rate '40% higher' than search bots comes from SEO gray literature with no reproducible methodology and should not be cited.

### Signal: nofollow on internal links / meta robots nofollow suppressing AI crawler link traversal — grade A (discovery-infra)

**Mechanism:** A page-level <meta name="robots" content="nofollow"> (or 'none') stops documented AI-serving crawlers from following any link on that page; per-link rel="nofollow" is treated by Google as a hint that links 'will generally not be followed'. Applying either to internal navigation therefore reduces discovery of the linked pages. Falsifiable: if pages linked only from nofollowed internal links are crawled and indexed at the same rate as normally linked pages, the claim fails.

**Evidence:** Apple's current Applebot documentation is unambiguous and names the behavior directly: among supported robots meta directives it lists 'nofollow: Applebot won't follow any links on the page' and 'none: Applebot won't index, snippet, or follow links on the page'. Applebot also supports these via the X-Robots-Tag HTTP header, and falls back to Googlebot's robots.txt rules when Applebot is not named — so Google-targeted directives leak into Apple's AI-grounding crawl. Google's own link-qualification documentation states that links marked nofollow, sponsored or ugc 'will generally not be followed'. Since Google's AI features require the target page to be 'indexed and eligible to be shown in Google Search with a snippet', suppressing traversal to a page suppresses its AI eligibility by the same chain established in signal 1. Two major vendors documenting the consumer behavior in their own crawler docs is what grade A requires.

**Counter-evidence:** Two significant qualifications. First, Apple's documented nofollow is the PAGE-LEVEL meta robots directive, not per-link rel="nofollow" — most audits conflate these, and Apple's docs say nothing about the rel attribute on individual anchors. An audit that flags a single rel="nofollow" internal link cannot cite the Applebot page as support. Second, Google demoted nofollow from directive to hint in September 2019. It states plainly that 'the linked pages may be found through other means, such as sitemaps or links from other sites, and thus they may still be crawled'. So nofollow does not reliably prevent discovery even for Google. OpenAI, Anthropic and Perplexity documentation is entirely silent on nofollow, with no evidence GPTBot, ClaudeBot or PerplexityBot honors it in either form. Scope the audit to meta robots nofollow/none on indexable pages, and treat per-link rel=nofollow on internal navigation as a weaker informational finding.

## The rewrite (`TODO(rewrite)`, approved 2026-08-21)

Both source audits measured the presence of a template, not internal linking, and both passed essentially every real site:

- **1.15 internal-linking** failed a page only when it had _literally zero_ internal anchors. Since `new URL('#main', page.url)` resolves to the page's own host, a lone "skip to content" accessibility link satisfied it. The guidance prescribed "3-5 internal links per page" — a threshold the code never enforced.
- **10.11 internal-cross-linking** required ≥ 2 internal links per page but counted the whole document, so any site with a header nav cleared the bar on every page. Its review calls it "a near-unconditional PASS running at `defaultPriority: 'high'`, consuming a high-weight report slot while distinguishing nothing".

The rewritten audit measures what both descriptions always claimed: contextual links in the body. Every required fix from the two reviews is in the list above — chrome exclusion, fragment and self-link exclusion, site-root and pagination exclusion, normalize-then-deduplicate (so `/about`, `/about/` and `/about?utm_source=nav` are one destination), www/bare-host normalization on both sides, the ≥ 2 bar applied to _contextual_ links, and `defaultPriority` at `medium` rather than `high`.

**One review finding deliberately not adopted:** both reviews list "SPA whose server HTML contains no anchors" as a false-positive risk. This dossier's own grade-A evidence says the opposite — Vercel and MERJ measured that no major AI crawler executes JavaScript, so a client-rendered nav genuinely is "a link-less void to GPTBot and ClaudeBot". A page with no server-rendered in-content links is a true finding for this audit, and the guidance copy names the cause. The site-wide `fail` still requires _every_ scanned page to be linkless, so a single JS-heavy page only warns.

Also out of scope: this audit does not read `rel="nofollow"` or `<meta name="robots" content="nofollow">`. The second evidence signal below grades that mechanism A for Applebot, but the same source warns that page-level meta-robots and per-link `rel` are different things and that Google treats `rel=nofollow` as a hint; it belongs in a dedicated check, not in a link-count.

## Absorbed evidence — internal-cross-linking (10.11)

10.11's dossier is kept verbatim at [merged/machine-discovery/internal-cross-linking.md](../../merged/machine-discovery/internal-cross-linking.md) (grade **B**). Its signal — internal link structure as the input AI engines use to build topic clusters — is the same claim as this audit's, at a different threshold, which is why the v2 map collapses them into this one rewritten check with 1.15 as the surviving row.

### Grade decision: stays **A**

10.11 graded **B**; this audit's own link-graph evidence grades **A** on two vendor-documented consumer paths (Google: "Google can only crawl your link if it's an `<a>` HTML element with an href attribute"; Apple: links are an explicit Apple Search ranking factor) plus the Vercel/MERJ measurement that the major AI crawlers do not execute JavaScript. The absorbed evidence is weaker, so nothing is raised: **A**, `tier: scored`, `weight 1.0`.

Note that the rewrite makes the audit _harder_ to pass at unchanged weight — deliberately. The A grade prices a real mechanism; it was previously spent on a check that could not fail a templated site.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources) on both source audits.
- 2026-08-21 — approved: 1.15 + 10.11 collapse into one rewritten `in-content-links` (in-content links only).
- 2026-08-22 — rewritten and merged (Plan 4, Task 4); registry 169 → 168.
