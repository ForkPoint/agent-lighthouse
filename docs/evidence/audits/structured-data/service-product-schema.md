---
audit: structured-data/service-product-schema
audit_id: "3.8"
category: structured-data
source_file: packages/core/src/audits/structured-data/service-product-schema.ts
slug: service-product-schema
review_verdict: merge
severity: medium
evidence_grade: A
disposition: "merge (approved 2026-08-21)"
reviewed: 2026-08-21
---

# service-product-schema (`3.8`)

> structured-data · source `service-product-schema.ts` · review verdict **merge** · evidence grade **A** · disposition: **merge (approved 2026-08-21)**

## What it checks

AI agents use Service/Product schema to understand what you offer, who provides it, and how to describe it to users. Without it, agents must infer your offerings from unstructured text, which leads to inaccurate or incomplete descriptions in AI-generated recommendations.

## Code review findings (2026-08-20, 11-agent pass)

Checks that a Product or Service node exists with name/description/provider, which is almost entirely subsumed by 3.22 (brand) and 3.24 (offers) for the Product half. Its own logic repeats the `serviceProducts[0]`-across-all-pages defect, uses a narrower type list than every sibling Product audit, and invents `description` as a requirement.

**Required fix:** Merge the Product half into 3.22 (Advanced product details), which already checks brand/category/availability on Product nodes and shares the same type list as 3.21/3.24. If the Service half is kept as a standalone audit, scope it to Service/ProfessionalService only, evaluate the best-covered node rather than `[0]`, and drop `description` from the required set.

**False-positive risks:**
- `const first = serviceProducts[0]` over `allSchemas(ctx)` — the first flattened Product across the whole scan. On any scan including a category page, that is a listing tile stub with `name` only, producing 'missing: description, brand/offers' while the real PDP is complete. Same defect as 3.21/3.22.
- `matchesAnyType(s, ['Service', 'Product'])` accepts a narrower set than its siblings, which use `['Product','IndividualProduct','ProductModel']`. A Shopify store marking up `ProductGroup` (the correct type for a variant parent) or a SaaS marking `SoftwareApplication` fails 3.8 with 'No Service or Product schema found' while simultaneously passing 3.22 and 3.24 on the same page — internally contradictory report.
- `description` is required for a pass, but schema.org does not require it and Google's Product guidance does not either. Well-formed Product blocks that omit description are permanently warned for a non-issue.
- Declared `applicablePageTypes: ['product']` yet judges the whole site graph, so a content site with one incidental Product node is scored on it.
- For Service, `provider` is mandatory — but Service schema on an agency site commonly nests inside an Organization (`"makesOffer"`), where the provider is implicit; that valid pattern is warned.

**Test gaps:**
- No test with a category page containing multiple Product stubs (the `[0]` selection defect)
- No test for `ProductGroup`, `IndividualProduct`, or `SoftwareApplication`
- No test asserting that a Product without `description` is acceptable
- No test for Service nested under an Organization's `makesOffer`

**Overlaps with:** `3.22`, `3.24`, `3.21`

## Evidence

### Signal: Product / Offer markup with price, priceCurrency, availability, condition and GTIN/SKU identifiers — grade A (structured-data)

**Mechanism:** A server-rendered Product object containing a nested Offer with price, priceCurrency, availability and condition, plus a sku or gtin, is crawled by Google Merchant Center's website-crawl (automated feeds) and used to build/refresh the merchant's catalog entries, which populate the Shopping Graph that Gemini queries in Google AI Mode shopping and agentic checkout. It is NOT the ingestion path for ChatGPT shopping, Perplexity shopping, or Amazon Rufus, all of which are feed- or first-party-catalog-based.

**Evidence:** This is the single strongest schema.org signal in the AI era, and the strength comes entirely from Google's commerce pipeline rather than from generic "AI reads schema" claims. Google documents the exact schema.org→attribute mapping (id→sku; gtin→gtin8/12/13/14/gtin/isbn; price→price+priceCurrency; availability→availability; condition→itemCondition) and states: "If you're using automatic item updates, make sure to specify the schema.org properties price, priceCurrency, availability, and condition" (google-merchant-supported-structured-data). Setup requires a Product object with a nested Offer (google-merchant-setup-structured-data). Automated feeds are built by "website crawl", which "uses structured data and sitemap information to extract the most up-to-date information about relevant products", re-checked at least every 24 hours (google-merchant-automated-feeds). Offer-level SKU/GTIN annotation is what lets the crawler match page offers to catalog items. Google's Product doc confirms the hybrid model: "Providing both structured data on web pages and a Merchant Center feed maximizes your eligibility to experiences" and "product snippets may use pricing data from your merchant feed if it's not present in the structured data on the page" (google-product-structured-data). Downstream, AI Mode shopping "brings together Gemini capabilities with the Shopping Graph", which holds 50B+ listings with reviews, prices, colors and availability, 2B refreshed hourly (google-shopping-graph-ai-mode). Google's changelog also shows Product markup under ACTIVE development in 2026 (Product.category codes, a new "Sale duration" section, hasAdultConsideration) while FAQ and HowTo were being retired (google-search-updates-changelog). Hard audit rule from Google: "Structured data markup must be present in the HTML returned from the web server. The structured data markup can't be generated with JavaScript after the page has loaded."

**Counter-evidence:** OpenAI's product feed spec is feed-only. Required fields are item_id, title, description, brand, url, image_url, availability, price, is_eligible_search, is_eligible_checkout, seller_name, target_countries; GTIN is optional; and there is NO mention of schema.org, JSON-LD or on-page markup anywhere in the spec or the wider commerce docs index (openai-product-feed-spec, openai-commerce-docs-index). The Agentic Commerce Protocol feed spec likewise defines its own taxonomy and does not reference schema.org, GTIN, or Merchant Center compatibility (acp-feed-spec). Perplexity's merchant program reportedly requires CSV/XML feeds (perplexity-merchant-program-terms — UNVERIFIED, hub returns 403). Amazon Rufus draws on the Amazon catalogue, customer reviews, community Q&A and "public information on the web", with no mention of schema.org or merchant markup crawling (amazon-science-rufus). And Google's AI guidance still says "there's no special schema.org markup you need to add", routing merchants to Merchant Center feeds and Business Profiles instead (google-ai-optimization-guide). Honest framing for the dossier: Product markup earns its A because it is a documented ingestion path into a Google system that demonstrably powers an AI shopping surface — not because any LLM reads it off the page at answer time.
**Consumers:** Google Merchant Center website crawl / automated feeds, Google Shopping Graph → Google AI Mode shopping & agentic checkout, Googlebot (product snippets, merchant listings), Applebot (Offers, PriceRange — archived doc) · **Recommended tier:** scored

**Sources:** [Supported structured data attributes and values — Merchant Center](https://support.google.com/merchants/answer/6386198) · [Set up structured data for Merchant Center](https://support.google.com/merchants/answer/7331077) · [Add products automatically from your online store (automated feeds / website crawl)](https://support.google.com/merchants/answer/7538732) · [Product structured data (Product snippets and Merchant listings)](https://developers.google.com/search/docs/appearance/structured-data/product) · [Shopping on Google: AI Mode and virtual try-on updates from I/O 2025](https://blog.google/products-and-platforms/products/shopping/google-shopping-ai-mode-virtual-try-on-update/) · [Latest Google Search documentation updates (changelog)](https://developers.google.com/search/updates) · [App Search Programming Guide: Mark Up Web Content](https://developer.apple.com/library/archive/documentation/General/Conceptual/AppSearch/WebContent.html) · [Web Data Commons Extraction Report — October 2024 Common Crawl Corpus](https://webdatacommons.org/structureddata/2024-12/stats/stats.html) · [Product Feed Spec — Products (Agentic Commerce)](https://developers.openai.com/commerce/specs/file-upload/products) · [Agentic Commerce documentation index](https://developers.openai.com/commerce/) · [Product Feed Specification — Agentic Commerce Protocol](https://agentic-commerce-protocol.com/docs/commerce/specs/feed) · [Perplexity Merchant Program Terms of Service](https://www.perplexity.ai/hub/legal/merchant-program-terms-of-service) · [The technology behind Amazon's GenAI-powered shopping assistant, Rufus](https://www.amazon.science/blog/the-technology-behind-amazons-genai-powered-shopping-assistant-rufus) · [Google's Guide to Optimizing for Generative AI Features on Google Search](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) · [The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
