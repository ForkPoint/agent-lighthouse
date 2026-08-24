---
audit: structured-data/json-ld-present
audit_id: "3.1"
category: structured-data
source_file: packages/core/src/audits/structured-data/json-ld-present.ts
slug: json-ld-present
review_verdict: fix
severity: high
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# json-ld-present (`3.1`)

> structured-data · source `json-ld-present.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

AI agents rely on JSON-LD structured data to understand what your site offers, who runs it, and how to interact with it. Without any JSON-LD, agents like ChatGPT and Perplexity treat your site as unstructured text with no machine-readable identity. Add Organization and WebSite schemas to your homepage <head> as a starting point.

## Code review findings (2026-08-20, 11-agent pass)

The presence check for JSON-LD is the right foundation audit, but it is the only audit in the category that reads `p.jsonLd` instead of `p.structuredData ?? p.jsonLd`, so Microdata/RDFa-only sites hard-fail at critical priority while every sibling audit passes on the same page. It also cannot distinguish 'no structured data' from 'malformed JSON', 'JS-rendered', or 'WAF blocked the fetch', and issues 'add JSON-LD' guidance in all four cases.

**Required fix:** Change to `ctx.pages.flatMap((p) => p.structuredData ?? p.jsonLd)` to match every sibling audit. Separately count raw `$('script[type="application/ld+json"]').length` per page so 'present but malformed' returns a distinct failure with parse-error guidance instead of 'add JSON-LD'. Return `notApplicable` (or a dedicated inconclusive status) when `ctx.wafProtection` indicates the fetch was challenged, and report block counts as (scripts, entities) rather than parsed roots.

**False-positive risks:**
- `const allBlocks = ctx.pages.flatMap((p) => p.jsonLd)` ignores `p.structuredData`, which the orchestrator populates with `[...jsonLd, ...extractMicrodata($), ...extractRdfa($)]`. A Salesforce Commerce Cloud / older Magento store expressing Product data entirely as Microdata gets a CRITICAL fail 'No JSON-LD structured data found on any page' while ProductIdentifiers/ProductDetails/Offer all pass on the exact same markup — self-contradictory report.
- `extractJsonLd` silently swallows JSON.parse failures (parser.ts:26), so a page whose only JSON-LD block has a trailing comma or an unescaped quote produces `jsonLd.length === 0`. The audit then tells the user to 'Add at least one JSON-LD script block' when the actual defect is a syntax error in the block they already have — actively wrong remediation.
- SPA / client-injected JSON-LD (react-helmet, next/script strategy=afterInteractive, Google Tag Manager schema injection) is invisible to the static fetch. The audit reports a critical failure for a site whose schema is present in the rendered DOM that agents with a headless browser (and Googlebot) do see.
- `ctx.wafProtection` is available on CheckContext and never consulted. A Cloudflare/Akamai/DataDome challenge body has no JSON-LD, so a protected site scores 0 on the category's most heavily-flagged check with no indication the scan was blocked.
- Counts parsed blocks, not scripts: a single `<script>` containing a top-level array of 12 entities counts as 1 (the test file asserts this), so 'Found 1 JSON-LD block(s)' understates coverage and the displayed number is not comparable between sites.

**Test gaps:**
- No test for a Microdata-only or RDFa-only page (mockPageContext never sets `structuredData`, so the primary false-fail path is unreachable in tests)
- No test for a page whose JSON-LD is syntactically malformed (should be distinguishable from absent)
- No test for a WAF/challenge body or a non-200 fetch result
- No test for a multi-page scan where only some pages carry JSON-LD
- No test for a non-HTML content type or an empty body

**Overlaps with:** `3.2`

## Evidence

### Signal: JSON-LD structured data presence and its effect on AI citation / visibility — grade A (structured-data)

**Mechanism:** Machine-parseable schema.org JSON-LD embedded in the server-returned HTML is extracted and used by named consumers (Googlebot for rich results and knowledge understanding, Google Merchant Center's website crawl, Applebot for Spotlight/Siri, Microsoft NLWeb as its MCP data layer). The SEPARATE claim that adding JSON-LD raises a page's citation rate in AI answer engines is FALSE for pages already in the index. A third claim — that JSON-LD injected only by client-side JavaScript reaches AI consumers — is also FALSE.

**Grade: A** — Consumption is documented, and that is the only half the grade covers. Google states plainly that "Google uses structured data that it finds on the web to understand the content of the page", Merchant Center's automated feeds are built by crawling schema.org markup, and Applebot's documentation enumerates the types it supports. Named consumers reading the format is the grade-A bar. The separate and much weaker claim — that adding JSON-LD raises a page's citation rate — is not what is graded here, and Google contradicts it directly: "Structured data isn't required for generative AI search, and there's no special schema.org markup you need to add." So the audit checks that machine-readable markup exists and parses, not that it buys visibility.

**Evidence:** Consumption is A-documented: Google states plainly that "Google uses structured data that it finds on the web to understand the content of the page" (google-intro-structured-data); Merchant Center's automated feeds are literally built by crawling schema.org markup (google-merchant-automated-feeds); Apple's Applebot doc enumerates supported schema.org types (apple-app-search-web-markup); NLWeb is built on "Schema.org and related semi-structured formats" and exposes them over MCP (nlweb-github). JSON-LD 1.1 is a W3C Recommendation (w3c-json-ld-11) and adoption is enormous — 834M URLs across 11.6M domains, 51.25% of crawled pages carry some structured data (webdatacommons-2024-stats). The CITATION-UPLIFT claim, however, is refuted by the best available experiment: Ahrefs' matched difference-in-differences on 1,885 pages adding JSON-LD vs ~4,000 controls found AI Mode +2.4% and ChatGPT +2.2% (both indistinguishable from zero) and AI Overviews −4.6% (significant, ~1-in-2,500 by chance) (ahrefs-schema-ai-citations). searchVIU's controlled fetch test found a price present only in JSON-LD was retrieved by 0 of 5 systems (ChatGPT, Claude, Gemini, Perplexity, AI Mode) (searchviu-schema-ai-fetch-test). arXiv 2603.10700 found "JSON-LD markup alone provides only modest improvements" to RAG, while purpose-built entity pages gave ~+29.6%. The rendering constraint is critical and audit-actionable: Googlebot CAN read JS-injected JSON-LD (google-intro-structured-data), but Merchant Center explicitly cannot ("can't be generated with JavaScript after the page has loaded") and no major AI crawler executes JavaScript at all (vercel-ai-crawler-rendering). SCORE this as machine-readability hygiene — presence, validity, server-rendering, and agreement with visible text — and never as an AI-citation lever.

**Counter-evidence:** Google's own AI docs are unambiguous: "Structured data isn't required for generative AI search, and there's no special schema.org markup you need to add" and "You don't need to create new machine readable files, AI text files, or markup to appear in these features" (google-ai-optimization-guide, google-ai-features-doc). Google's agent-facing guidance (web-dev-agent-friendly-sites) never mentions schema.org, naming screenshots, DOM and the accessibility tree instead. The largest AI-visibility correlation study (75k brands) did not even measure schema as a factor (ahrefs-brand-visibility-correlations). The widely-repeated "53% of AI-cited pages have schema, ~3x the rate of uncited pages" statistic is confounded — the Ahrefs authors attribute it to site quality, not markup. Note the honest limit on the null result: Ahrefs sampled only pages already receiving 100+ AI Overview citations, so it cannot rule out an effect on first-time discovery, parsing or indexing.
**Consumers:** Googlebot / Google Search, Google Merchant Center website crawl, Applebot (archived doc), Microsoft NLWeb (MCP server), Bingbot (recommended, mechanism unstated) · **Recommended tier:** scored

**Sources:** [Intro to how structured data markup works](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data) (verified 2026-08-20) · [JSON-LD 1.1 — A JSON-based Serialization for Linked Data](https://www.w3.org/TR/json-ld11/) (verified 2026-08-20) · [About schema.org](https://schema.org/docs/about.html) (verified 2026-08-20) · [Web Data Commons Extraction Report — October 2024 Common Crawl Corpus](https://webdatacommons.org/structureddata/2024-12/stats/stats.html) (verified 2026-08-20) · [We Tracked 1,885 Pages Adding Schema. AI Citations Barely Moved.](https://ahrefs.com/blog/schema-ai-citations/) (verified 2026-08-20) · [Schema Markup and AI in 2025: What ChatGPT, Claude, Perplexity & Gemini Really See](https://www.searchviu.com/en/schema-markup-and-ai-in-2025-what-chatgpt-claude-perplexity-gemini-really-see/) (verified 2026-08-20) · [Structured Linked Data as a Memory Layer for Agent-Orchestrated Retrieval](https://arxiv.org/abs/2603.10700) (verified 2026-08-20) · [The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler) (verified 2026-08-20) · [AI Features and Your Website](https://developers.google.com/search/docs/appearance/ai-features) (verified 2026-08-20) · [Google's Guide to Optimizing for Generative AI Features on Google Search](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) (verified 2026-08-20) · [Build agent-friendly websites](https://web.dev/articles/ai-agent-site-ux) (verified 2026-08-20) · [Top Brand Visibility Factors in ChatGPT, AI Mode, and AI Overviews (75k Brands Studied)](https://ahrefs.com/blog/ai-brand-visibility-correlations/) (verified 2026-08-20) · [NLWeb — reference implementation](https://github.com/nlweb-ai/NLWeb) (verified 2026-08-20) · [App Search Programming Guide: Mark Up Web Content](https://developer.apple.com/library/archive/documentation/General/Conceptual/AppSearch/WebContent.html) (verified 2026-08-20) · [Optimizing Your Content for Inclusion in AI Search Answers](https://about.ads.microsoft.com/en/blog/post/october-2025/optimizing-your-content-for-inclusion-in-ai-search-answers) (verified 2026-08-20) · [Add products automatically from your online store (automated feeds / website crawl)](https://support.google.com/merchants/answer/7538732) (verified 2026-08-20)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
