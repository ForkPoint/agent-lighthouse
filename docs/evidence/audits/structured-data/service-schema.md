---
audit: structured-data/service-schema
category: structured-data
source_file: packages/core/src/audits/structured-data/service-schema.ts
slug: service-schema
evidence_grade: A
disposition: "split 2026-08-22 (Plan 4, Task 9) — Service half kept here, Product half moved to advanced-product-details (3.22)"
reviewed: 2026-08-22
recommended_tier: scored
consumers:
  - Google Merchant Center website crawl / automated feeds
  - "Google Shopping Graph → Google AI Mode shopping & agentic checkout"
  - "Googlebot (product snippets, merchant listings)"
  - "Applebot (Offers, PriceRange — archived doc)"
signals:
  - name: "Product / Offer markup with price, priceCurrency, availability, condition and GTIN/SKU identifiers"
    grade: A
    domain: structured-data
sources:
  - google-merchant-supported-structured-data
  - google-merchant-setup-structured-data
  - google-merchant-automated-feeds
  - google-product-structured-data
  - google-shopping-graph-ai-mode
  - google-search-updates-changelog
  - apple-app-search-web-markup
  - webdatacommons-2024-stats
  - openai-product-feed-spec
  - openai-commerce-index
  - acp-feed-spec
  - perplexity-merchant-program-terms
  - amazon-science-rufus
  - google-ai-optimization-mythbusting
  - vercel-rise-of-ai-crawler
---

# service-schema (`3.8`)

> structured-data · source `service-schema.ts` · split survivor: the Service half of v1 `service-product-schema` · evidence grade **A** · tier **scored** (weight 1.0)

## What it checks

The v7 runner includes `article` and `general` pages in this check's existing page population. This preserves coverage when the old catch-all classification becomes unknown. The audit body still owns its existing feature and artifact guards. This scope change does not establish a new consumer path.

AI agents use Service schema to understand what you offer and who provides it. Without it, agents must infer your offerings from unstructured text, which leads to inaccurate or incomplete descriptions in AI-generated recommendations.

A `Service` or `ProfessionalService` node must carry `name` and `provider`. Product shapes are **not** this audit's business any more — see the split below.

## Evidence

### Signal: Product / Offer markup with price, priceCurrency, availability, condition and GTIN/SKU identifiers — grade A (structured-data)

**Mechanism:** Google Merchant Center's website-crawl, its automated-feeds path, crawls a server-rendered Product object that contains a nested Offer with price, priceCurrency, availability and condition, plus a sku or gtin. It uses that object to build and refresh the merchant's catalog entries. Those entries populate the Shopping Graph that Gemini queries in Google AI Mode shopping and agentic checkout. It is not the ingestion path for ChatGPT shopping, Perplexity shopping, or Amazon Rufus, all of which are feed- or first-party-catalog-based.

**Grade: A** — The strongest schema.org signal in the corpus, and its strength comes from one specific pipeline rather than from a general "AI reads schema" claim. Google documents the exact schema.org-to-attribute mapping used by Merchant Center's website crawl: `id` to `sku`, `gtin` to the GTIN family, `price` to `price` and `priceCurrency`, and `availability` and `condition` each to their own attribute. Those entries feed the Shopping Graph that Gemini queries in AI Mode shopping. A named consumer with a published field mapping is grade A. It does not generalise to OpenAI, whose product feed specification is feed-only and never mentions schema.org, JSON-LD or on-page markup.

**Evidence:** This is the single strongest schema.org signal in the AI era, and the strength comes entirely from Google's commerce pipeline rather than from generic "AI reads schema" claims. Google documents the exact schema.org→attribute mapping (id→sku; gtin→gtin8/12/13/14/gtin/isbn; price→price+priceCurrency; availability→availability; condition→itemCondition) and states: "If you're using automatic item updates, make sure to specify the schema.org properties price, priceCurrency, availability, and condition" (google-merchant-supported-structured-data). Setup requires a Product object with a nested Offer (google-merchant-setup-structured-data). Automated feeds are built by "website crawl", which "uses structured data and sitemap information to extract the most up-to-date information about relevant products", re-checked at least every 24 hours (google-merchant-automated-feeds). Offer-level SKU/GTIN annotation is what lets the crawler match page offers to catalog items. Google's Product doc confirms the hybrid model. "Providing both structured data on web pages and a Merchant Center feed maximizes your eligibility to experiences." And "product snippets may use pricing data from your merchant feed if it's not present in the structured data on the page" (google-product-structured-data). Downstream, AI Mode shopping "brings together Gemini capabilities with the Shopping Graph", which holds 50B+ listings with reviews, prices, colors and availability, 2B refreshed hourly (google-shopping-graph-ai-mode). Google's changelog also shows Product markup under ACTIVE development in 2026 (Product.category codes, a new "Sale duration" section, hasAdultConsideration) while FAQ and HowTo were being retired (google-search-updates-changelog). Hard audit rule from Google: "Structured data markup must be present in the HTML returned from the web server. The structured data markup can't be generated with JavaScript after the page has loaded."

**Counter-evidence:** OpenAI's product feed spec is feed-only. Required fields are item_id, title, description, brand, url, image_url, availability, price, is_eligible_search, is_eligible_checkout, seller_name and target_countries. GTIN is optional. There is no mention of schema.org, JSON-LD or on-page markup anywhere in the spec or the wider commerce docs index (openai-product-feed-spec, openai-commerce-docs-index). The Agentic Commerce Protocol feed spec likewise defines its own taxonomy and does not reference schema.org, GTIN, or Merchant Center compatibility (acp-feed-spec). Perplexity's merchant program reportedly requires CSV/XML feeds (perplexity-merchant-program-terms — UNVERIFIED, hub returns 403). Amazon Rufus draws on the Amazon catalogue, customer reviews, community Q&A and "public information on the web", with no mention of schema.org or merchant markup crawling (amazon-science-rufus). And Google's AI guidance still says "there's no special schema.org markup you need to add", routing merchants to Merchant Center feeds and Business Profiles instead (google-ai-optimization-guide). Honest framing for the dossier. Product markup earns its A because it is a documented ingestion path into a Google system that demonstrably powers an AI shopping surface. It does not earn it because an LLM reads it off the page at answer time.

## Implementation deviations

- This audit holds the Service half of the former `service-product-schema`
  check. The Product half is
  [`structured-data/advanced-product-details`](./advanced-product-details.md).
- Only `Service` and `ProfessionalService` nodes count. A `Product` node is
  neither a subject nor evidence that a service exists.
- The best-covered node decides the verdict, not the first one found.
- `name` and `provider` are required. `description` is not.
- The audit runs on homepage, general and article pages. A page is in scope
  when it carries Service markup, sits in a services section, or links to
  one. With no such page, the result is `notApplicable`.
- Path and link matching anchor on segments and offering phrases (`/services`,
  `/what-we-do`, `/solutions`, `/consulting`, "our services"). A
  terms-of-service path or a "Customer service" link does not count.
- The schema search is site-wide. A site may declare its Service nodes on the
  homepage while the services link lives elsewhere.

## Deferred

- A Service nested under an Organization's `makesOffer` is warned for a
  missing `provider`. Resolving the implicit provider is a parser-level
  change.
- No Service-specific consumer path has been researched. The grade rests on
  the Product/Offer record.
- The homepage, general and article list is a broad list kept while
  classification changes. Its review is open in
  `docs/architecture/audits.md#511-default-scope-and-page-type-restrictions`.
