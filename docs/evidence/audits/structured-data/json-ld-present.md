---
audit: structured-data/json-ld-present
category: structured-data
source_file: packages/core/src/audits/structured-data/json-ld-present.ts
slug: json-ld-present
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: scored
consumers:
  - Googlebot / Google Search
  - Google Merchant Center website crawl
  - Applebot (archived doc)
  - Microsoft NLWeb (MCP server)
  - "Bingbot (recommended, mechanism unstated)"
signals:
  - name: JSON-LD structured data presence and its effect on AI citation / visibility
    grade: A
    domain: structured-data
sources:
  - google-intro-structured-data
  - w3c-json-ld-11
  - schemaorg-about
  - webdatacommons-2024-stats
  - ahrefs-schema-ai-citations
  - searchviu-schema-ai-fetch-test
  - arxiv-structured-linked-data-memory-layer
  - vercel-rise-of-ai-crawler
  - google-ai-features-trust
  - google-ai-optimization-mythbusting
  - web-dev-agent-friendly-sites
  - ahrefs-brand-visibility-correlations
  - nlweb-repo-howto
  - apple-app-search-web-markup
  - microsoft-ads-ai-search-optimization
  - google-merchant-automated-feeds
---

# json-ld-present (`3.1`)

> structured-data · source `json-ld-present.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

AI agents rely on JSON-LD structured data to understand what your site offers, who runs it, and how to interact with it. Without any JSON-LD, agents like ChatGPT and Perplexity treat your site as unstructured text with no machine-readable identity. Add Organization and WebSite schemas to your homepage <head> as a starting point.

## Evidence

### Signal: JSON-LD structured data presence and its effect on AI citation / visibility — grade A (structured-data)

**Mechanism:** Machine-parseable schema.org JSON-LD embedded in the server-returned HTML is extracted and used by named consumers (Googlebot for rich results and knowledge understanding, Google Merchant Center's website crawl, Applebot for Spotlight/Siri, Microsoft NLWeb as its MCP data layer). The SEPARATE claim that adding JSON-LD raises a page's citation rate in AI answer engines is false for pages already in the index. A third claim — that JSON-LD injected only by client-side JavaScript reaches AI consumers — is also false.

**Grade: A** — Consumption is documented, and that is the only half the grade covers. Google states plainly that "Google uses structured data that it finds on the web to understand the content of the page", Merchant Center's automated feeds are built by crawling schema.org markup, and Applebot's documentation enumerates the types it supports. Named consumers reading the format is the grade-A bar. A separate and much weaker claim — that adding JSON-LD raises a page's citation rate — is not what is graded here. Google contradicts that one directly: "Structured data isn't required for generative AI search, and there's no special schema.org markup you need to add." So the audit checks that machine-readable markup exists and parses, not that it buys visibility.

**Evidence:** Consumption is A-documented. Google states plainly that "Google uses structured data that it finds on the web to understand the content of the page" (google-intro-structured-data). Merchant Center's automated feeds are built by crawling schema.org markup (google-merchant-automated-feeds). Apple's Applebot doc enumerates the supported schema.org types (apple-app-search-web-markup). And NLWeb is built on "Schema.org and related semi-structured formats", which it exposes over MCP (nlweb-github). JSON-LD 1.1 is a W3C Recommendation (w3c-json-ld-11) and adoption is enormous — 834M URLs across 11.6M domains, 51.25% of crawled pages carry some structured data (webdatacommons-2024-stats). The citation-uplift claim, however, is refuted by the best available experiment. Ahrefs ran a matched difference-in-differences on 1,885 pages that added JSON-LD against about 4,000 controls. AI Mode came out at +2.4% and ChatGPT at +2.2%, both indistinguishable from zero. AI Overviews came out at −4.6%, which is significant at about 1-in-2,500 by chance (ahrefs-schema-ai-citations). searchVIU's controlled fetch test found that a price present only in JSON-LD was retrieved by 0 of 5 systems: ChatGPT, Claude, Gemini, Perplexity and AI Mode (searchviu-schema-ai-fetch-test). arXiv 2603.10700 found "JSON-LD markup alone provides only modest improvements" to RAG, while purpose-built entity pages gave about +29.6%. The rendering constraint is critical, and audit-actionable. Googlebot can read JS-injected JSON-LD (google-intro-structured-data). Merchant Center explicitly cannot: markup "can't be generated with JavaScript after the page has loaded". No major AI crawler executes JavaScript at all (vercel-ai-crawler-rendering). Score this as machine-readability hygiene — presence, validity, server-rendering, and agreement with visible text — and never as an AI-citation lever.

**Counter-evidence:** Google's own AI docs are unambiguous. "Structured data isn't required for generative AI search, and there's no special schema.org markup you need to add." And: "You don't need to create new machine readable files, AI text files, or markup to appear in these features" (google-ai-optimization-guide, google-ai-features-doc). Google's agent-facing guidance (web-dev-agent-friendly-sites) never mentions schema.org, naming screenshots, DOM and the accessibility tree instead. The largest AI-visibility correlation study (75k brands) did not even measure schema as a factor (ahrefs-brand-visibility-correlations). The widely-repeated "53% of AI-cited pages have schema, ~3x the rate of uncited pages" statistic is confounded — the Ahrefs authors attribute it to site quality, not markup. Note the honest limit on the null result: Ahrefs sampled only pages already receiving 100+ AI Overview citations, so it cannot rule out an effect on first-time discovery, parsing or indexing.

## Limits

### Browser snapshot evidence

The snapshot path reuses this audit on each complete, unredacted, non-loading DOM capture that carries readable text. It reports the original static verdict as an unscored browser finding. It does not prove HTTP delivery, computed appearance, a complete accessibility tree, live form state, or action success. The source and page URL accompany every finding. Existing implementation limits still apply.

The individual evidence review and limits appear in [Browser-rendered snapshot assessment](../../../architecture/browser-snapshots.md#supported-audit-inventory). The explicit eligibility record lives in `packages/core/src/snapshot-eligibility.ts`. Original crawler grades, tiers, and weights stay unchanged.

## Implementation deviations

Browser snapshots provide serialized markup observations only. The browser assessment uses informative display and weight 0. It does not extend the dossier's crawler scoring claim to browser task success. Truncated, redacted, and still-loading captures produce missing-evidence records rather than verdicts.
