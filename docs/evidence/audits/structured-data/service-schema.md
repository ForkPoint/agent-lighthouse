---
audit: structured-data/service-schema
category: structured-data
source_file: packages/core/src/audits/structured-data/service-schema.ts
slug: service-schema
evidence_grade: C
disposition: "2026-10-21: informative; Product/Offer evidence does not establish a Service consumer"
reviewed: 2026-10-21
recommended_tier: informative
consumers:
  - none-documented-for-service-name-provider
signals:
  - name: Service markup name and provider coverage
    grade: C
    domain: structured-data
sources:
  - schema-service
  - schema-professional-service
  - google-service-site-office-hours
  - google-search-gallery
  - google-product-structured-data
---

# service-schema (`3.8`)

> structured-data · source `service-schema.ts` · evidence grade **C** · tier **informative** (weight 0)

## What it checks

Reports whether existing Service markup includes `name` and `provider`.
It accepts the legacy `ProfessionalService` shape for compatibility.
It does not ask a site to adopt either type.

The check runs on every page type. Only existing markup enters its population.
A services URL or navigation link does not establish a markup obligation.
No matching node means `notApplicable`.

## Why it matters

The fields describe a service and its provider in a shared vocabulary.
No reviewed source documents an agent outcome that requires this pair.
The finding is descriptive and does not affect the score.

## Evidence

**Grade: C** — a live vocabulary with adoption, but no documented consumer
requirement for this audit's `name`/`provider` pair.

- [Schema.org Service](https://schema.org/Service) (verified 2026-10-21;
  `schema-service`) defines the vocabulary and reports adoption across
  1M–10M domains. This is adoption evidence, not proof of agent consumption.
- [Google's service-site guidance](https://developers.google.com/search/help/office-hours/2023/january)
  (verified 2026-10-21; `google-service-site-office-hours`) recommends
  LocalBusiness for the service business in its example.
- [Google's supported features](https://developers.google.com/search/docs/appearance/structured-data/search-gallery)
  and [Product guidance](https://developers.google.com/search/docs/appearance/structured-data/product)
  (verified 2026-10-21; `google-search-gallery`, `google-product-structured-data`)
  do not establish a generic Service requirement. Product/Offer evidence
  cannot justify this separate check's grade.
- [ProfessionalService](https://schema.org/ProfessionalService)
  (verified 2026-10-21; `schema-professional-service`) is a deprecated
  LocalBusiness type. It is not another name for Service.

## Limits

The review establishes no scored consumer path. It does not prove that no
consumer exists anywhere. `name` and `provider` are coverage conventions,
not mandatory Schema.org properties. The check keeps its existing truthy-value
and best-covered-node tests; it is not schema validation.

## How it scores

No score weight. Missing markup is `notApplicable`. An existing node with
both fields passes. Otherwise the finding warns about the missing fields.
The most complete node decides the verdict across readable sampled pages.

## Example finding

A published Service node names Consulting but has no provider. The report
notes the missing provider at weight 0. A page with no Service markup gets
no finding, even when its URL is `/services`.

## Sources

`schema-service`, `schema-professional-service`, `google-service-site-office-hours`,
`google-search-gallery`, `google-product-structured-data`.

## Implementation deviations

- 2026-10-21: grade A/scored becomes C/informative. The inherited Product/Offer
  evidence did not cover the Service half of the 2026-08-22 split.
- Remove the homepage/general/article list. Existing markup, not page type,
  selects the population. Preserve the best-covered-node aggregation.
- Keep ProfessionalService recognition for compatibility, without recommending
  the deprecated type or treating it as a Service subtype.

## Deferred

- Resolve an implicit provider from an Organization's `makesOffer`.
- Validate property values and measure coverage per Service node.
- A scored tier needs a documented consumer and the exact fields it requires.

## Historical Product evidence before the 2026-10-21 correction

The former evidence follows as the record of why the grade changed. It does
not support the current Service check and is not published as its evidence.

### Signal: Product / Offer markup with price, priceCurrency, availability, condition and GTIN/SKU identifiers — grade A (structured-data)

**Mechanism:** Google Merchant Center's website-crawl, its automated-feeds path, crawls a server-rendered Product object that contains a nested Offer with price, priceCurrency, availability and condition, plus a sku or gtin. It uses that object to build and refresh the merchant's catalog entries. Those entries populate the Shopping Graph that Gemini queries in Google AI Mode shopping and agentic checkout. It is not the ingestion path for ChatGPT shopping, Perplexity shopping, or Amazon Rufus, all of which are feed- or first-party-catalog-based.

**Grade: A** — The strongest schema.org signal in the corpus, and its strength comes from one specific pipeline rather than from a general "AI reads schema" claim. Google documents the exact schema.org-to-attribute mapping used by Merchant Center's website crawl: `id` to `sku`, `gtin` to the GTIN family, `price` to `price` and `priceCurrency`, and `availability` and `condition` each to their own attribute. Those entries feed the Shopping Graph that Gemini queries in AI Mode shopping. A named consumer with a published field mapping is grade A. It does not generalise to OpenAI, whose product feed specification is feed-only and never mentions schema.org, JSON-LD or on-page markup.

**Evidence:** This is the single strongest schema.org signal in the AI era, and the strength comes entirely from Google's commerce pipeline rather than from generic "AI reads schema" claims. Google documents the exact schema.org→attribute mapping (id→sku; gtin→gtin8/12/13/14/gtin/isbn; price→price+priceCurrency; availability→availability; condition→itemCondition) and states: "If you're using automatic item updates, make sure to specify the schema.org properties price, priceCurrency, availability, and condition" (google-merchant-supported-structured-data). Setup requires a Product object with a nested Offer (google-merchant-setup-structured-data). Automated feeds are built by "website crawl", which "uses structured data and sitemap information to extract the most up-to-date information about relevant products", re-checked at least every 24 hours (google-merchant-automated-feeds). Offer-level SKU/GTIN annotation is what lets the crawler match page offers to catalog items. Google's Product doc confirms the hybrid model. "Providing both structured data on web pages and a Merchant Center feed maximizes your eligibility to experiences." And "product snippets may use pricing data from your merchant feed if it's not present in the structured data on the page" (google-product-structured-data). Downstream, AI Mode shopping "brings together Gemini capabilities with the Shopping Graph", which holds 50B+ listings with reviews, prices, colors and availability, 2B refreshed hourly (google-shopping-graph-ai-mode). Google's changelog also shows Product markup under ACTIVE development in 2026 (Product.category codes, a new "Sale duration" section, hasAdultConsideration) while FAQ and HowTo were being retired (google-search-updates-changelog). Hard audit rule from Google: "Structured data markup must be present in the HTML returned from the web server. The structured data markup can't be generated with JavaScript after the page has loaded."

**Counter-evidence:** OpenAI's product feed spec is feed-only. Required fields are item_id, title, description, brand, url, image_url, availability, price, is_eligible_search, is_eligible_checkout, seller_name and target_countries. GTIN is optional. There is no mention of schema.org, JSON-LD or on-page markup anywhere in the spec or the wider commerce docs index (openai-product-feed-spec, openai-commerce-docs-index). The Agentic Commerce Protocol feed spec likewise defines its own taxonomy and does not reference schema.org, GTIN, or Merchant Center compatibility (acp-feed-spec). Perplexity's merchant program reportedly requires CSV/XML feeds (perplexity-merchant-program-terms — UNVERIFIED, hub returns 403). Amazon Rufus draws on the Amazon catalogue, customer reviews, community Q&A and "public information on the web", with no mention of schema.org or merchant markup crawling (amazon-science-rufus). And Google's AI guidance still says "there's no special schema.org markup you need to add", routing merchants to Merchant Center feeds and Business Profiles instead (google-ai-optimization-guide). Honest framing for the dossier. Product markup earns its A because it is a documented ingestion path into a Google system that demonstrably powers an AI shopping surface. It does not earn it because an LLM reads it off the page at answer time.
