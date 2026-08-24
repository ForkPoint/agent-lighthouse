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
  - "Applebot (Offers, PriceRange"
consumers_note: archived doc)
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

AI agents use Service schema to understand what you offer and who provides it. Without it, agents must infer your offerings from unstructured text, which leads to inaccurate or incomplete descriptions in AI-generated recommendations.

A `Service` or `ProfessionalService` node must carry `name` and `provider`. Product shapes are **not** this audit's business any more — see the split below.

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

**Grade: A** — The strongest schema.org signal in the corpus, and its strength comes from one specific pipeline rather than from a general "AI reads schema" claim. Google documents the exact schema.org-to-attribute mapping used by Merchant Center's website crawl — `id` to `sku`, `gtin` to the GTIN family, `price` to `price` and `priceCurrency`, `availability` and `condition` each to their own attribute — and those entries feed the Shopping Graph that Gemini queries in AI Mode shopping. A named consumer with a published field mapping is grade A. It does not generalise to OpenAI, whose product feed specification is feed-only and never mentions schema.org, JSON-LD or on-page markup.

**Evidence:** This is the single strongest schema.org signal in the AI era, and the strength comes entirely from Google's commerce pipeline rather than from generic "AI reads schema" claims. Google documents the exact schema.org→attribute mapping (id→sku; gtin→gtin8/12/13/14/gtin/isbn; price→price+priceCurrency; availability→availability; condition→itemCondition) and states: "If you're using automatic item updates, make sure to specify the schema.org properties price, priceCurrency, availability, and condition" (google-merchant-supported-structured-data). Setup requires a Product object with a nested Offer (google-merchant-setup-structured-data). Automated feeds are built by "website crawl", which "uses structured data and sitemap information to extract the most up-to-date information about relevant products", re-checked at least every 24 hours (google-merchant-automated-feeds). Offer-level SKU/GTIN annotation is what lets the crawler match page offers to catalog items. Google's Product doc confirms the hybrid model: "Providing both structured data on web pages and a Merchant Center feed maximizes your eligibility to experiences" and "product snippets may use pricing data from your merchant feed if it's not present in the structured data on the page" (google-product-structured-data). Downstream, AI Mode shopping "brings together Gemini capabilities with the Shopping Graph", which holds 50B+ listings with reviews, prices, colors and availability, 2B refreshed hourly (google-shopping-graph-ai-mode). Google's changelog also shows Product markup under ACTIVE development in 2026 (Product.category codes, a new "Sale duration" section, hasAdultConsideration) while FAQ and HowTo were being retired (google-search-updates-changelog). Hard audit rule from Google: "Structured data markup must be present in the HTML returned from the web server. The structured data markup can't be generated with JavaScript after the page has loaded."

**Counter-evidence:** OpenAI's product feed spec is feed-only. Required fields are item_id, title, description, brand, url, image_url, availability, price, is_eligible_search, is_eligible_checkout, seller_name, target_countries; GTIN is optional; and there is NO mention of schema.org, JSON-LD or on-page markup anywhere in the spec or the wider commerce docs index (openai-product-feed-spec, openai-commerce-docs-index). The Agentic Commerce Protocol feed spec likewise defines its own taxonomy and does not reference schema.org, GTIN, or Merchant Center compatibility (acp-feed-spec). Perplexity's merchant program reportedly requires CSV/XML feeds (perplexity-merchant-program-terms — UNVERIFIED, hub returns 403). Amazon Rufus draws on the Amazon catalogue, customer reviews, community Q&A and "public information on the web", with no mention of schema.org or merchant markup crawling (amazon-science-rufus). And Google's AI guidance still says "there's no special schema.org markup you need to add", routing merchants to Merchant Center feeds and Business Profiles instead (google-ai-optimization-guide). Honest framing for the dossier: Product markup earns its A because it is a documented ingestion path into a Google system that demonstrably powers an AI shopping surface — not because any LLM reads it off the page at answer time.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-21 — approved: §5 split — Product half → 3.22, Service half stays standalone and narrowed.
- 2026-08-22 — split landed (Plan 4, Task 9); audit renamed `structured-data/service-product-schema` → `structured-data/service-schema`, this dossier renamed with it. Registry count unchanged by this half (net 0).
- 2026-08-22 — review round 1: scoping corrected. `applicablePageTypes` moves from the inherited `['product']` to `['homepage', 'content']` and a runtime service-intent guard returns `na` on sites that offer no services. See "Scoping" below.

## The split (Plan 4, Task 9, 2026-08-22)

3.8 measured two unrelated shapes through one node list: `matchesAnyType(s, ['Service', 'Product'])`, then branched on `isProduct` for the rest of the check. Its required fix splits them:

> *"Merge the Product half into 3.22 (Advanced product details), which already checks brand/category/availability on Product nodes and shares the same type list as 3.21/3.24. If the Service half is kept as a standalone audit, scope it to Service/ProfessionalService only, evaluate the best-covered node rather than `[0]`, and drop `description` from the required set."*

Both halves of that instruction landed. The file was `git mv`d to `service-schema.ts`, the id is `structured-data/service-schema`, and all three Service-side clauses are implemented and locked by tests:

| Clause | Before | Now |
| :--- | :--- | :--- |
| type list | `['Service', 'Product']` | `['Service', 'ProfessionalService']` — a `Product` node no longer counts as a subject, nor as evidence that "a service exists" |
| node selection | `serviceProducts[0]` across the whole scan | the best-covered node: a listing stub hoisted ahead of the real Service node can no longer decide the verdict |
| required set | `name`, `description`, `provider` | `name`, `provider` — `description` dropped |

`description` was 3.8's own recorded invented requirement: *"schema.org does not require it and Google's Product guidance does not either. Well-formed Product blocks that omit description are permanently warned for a non-issue."* It is gone from the required set on both sides of the split; the guidance sample still shows it, because writing one is good practice, it is simply not pass-blocking.

### Where the Product half went

Into [`structured-data/advanced-product-details`](./advanced-product-details.md) (v1 3.22), which already owns Product nodes and already uses the wider `['Product', 'IndividualProduct', 'ProductModel']` type list that 3.8's review flagged as the correct one. What actually ported is the **`name` requirement**: 3.22 checked brand, category and availability but never that the Product had a name, and Google's merchant-listing table marks `name` required (unlike the other three, which are recommended). Two of 3.8's Product-side behaviours were deliberately **not** ported, and 3.22's dossier records both: its `description` requirement (invented, as above) and its `brand || manufacturer || provider || offers` fallback, which would have let an Offer stand in for a brand.

The migration-map row for 3.8 keeps `status: "renamed"` and points at `structured-data/service-schema`, with a `note` recording the Product half's destination. A consumer of 3.8 who cared about Products is not silently dropped — they land here and the note routes them on.

### Grade decision: stays **A**, tier `scored`, weight 1.0

The A-grade record this audit rests on is the Product/Offer commerce-markup signal, and its consumer path (Google Merchant Center website crawl → Shopping Graph → AI Mode shopping) is a *Product* path, not a Service path — that is an honest weakness of the original grading, and the split does not change it, because the same record is what 3.22 is graded on and 3.22 is where the Product shape now lives. Nothing in this task raises or lowers the evidence, so per the weight law the grade stays **A** at `tier: scored`, `weightForGrade('A', 'scored')` = **1.0**, on both audits. The Service half's own evidence remains the weakest link in this dossier and is called out as a standing item below.

### Scoping: which sites this runs on (fixed 2026-08-22, review round 1)

The split originally left `applicablePageTypes: ['product']` in place, inherited from the pre-split audit where it was correct for the Product half. For a Service-only check it is exactly backwards, and the effect is not cosmetic: `planAudits()` never *executes* an audit whose declared page types are absent from the scan, stubbing it as `na`. So the audit

- **never ran on the sites it is for.** An agency, consultancy or trades site publishes no `product` page, so the check was skipped outright — invisible, and excluded from the commerce vital.
- **ran only on the sites it does not fit,** ecommerce stores, where it was a guaranteed `fail`: stores emit Product markup, not `Service`. v1 3.8 passed those stores on their Product markup; after the narrowing, the same store failed a check about services it does not sell.

Fixed by mirroring how the siblings gate — a coarse page-type declaration plus a runtime precondition that returns `notApplicable`, exactly the shape of [`local-business-schema`](./local-business-schema.md) (`['homepage']` + a physical-location guard) and [`article-schema`](./article-schema.md) (`['content']` + a real-article-page guard):

- `applicablePageTypes: ['homepage', 'content']` — where a service business publishes its offerings. Both types are present in essentially every scan, so the coarse gate no longer decides anything; it declares intent and stops claiming this is a product-page audit.
- A page is in scope when it **carries Service/ProfessionalService markup** (the strongest evidence of intent), when **its own URL sits in a services section**, or when it **links to one**. No page matching → `na` with "No service offering detected".

Path and link matching are deliberately anchored on segments and on offering-phrases (`/services`, `/our-services`, `/what-we-do`, `/solutions`, `/consulting`; "our services", "what we do") so that `/legal/terms-of-service` and a "Customer service" help link — chrome on almost every store — do not drag ecommerce back into scope. Tests pin both directions: a service site with Service markup runs and passes; a product store with neither markup nor a services section is `na`, not `fail`; and a site that clearly sells services but publishes no Service markup still **fails**, which is the case the audit exists for.

The schema search itself stays site-wide (`allSchemas(ctx)`): a site may declare its Service nodes on the homepage while the services link lives elsewhere.

### Deviations — standing required-fix items not addressed here

- **A Service nested under an Organization's `makesOffer`** — where the provider is implicit — is still warned for a missing `provider`. Recorded in the false-positive list above; resolving implicit providers is a parser-level change, not part of this split.
- **The Service half has no Service-specific graded evidence.** The graded record below is a Product/Offer record. A dedicated Service-schema consumer path has never been researched, so the A rests on a mechanism that now lives mostly in 3.22. This is the item to revisit if the Service half is ever re-graded.
