---
audit: structured-data/advanced-product-details
category: structured-data
source_file: packages/core/src/audits/structured-data/advanced-product-details.ts
slug: advanced-product-details
evidence_grade: A
disposition: "keep — fix required; absorbs the Product half of service-product-schema (3.8) as of 2026-08-22"
reviewed: 2026-08-22
sources:
  - google-merchant-listing
  - google-auto-item-updates
  - google-merchant-structured-data
  - openai-feed-spec-confirm
  - google-product-snippet
  - google-ai-features-trust
---

# advanced-product-details (`3.22`, Product half of `3.8`)

> structured-data · source `advanced-product-details.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**, now also the home of 3.8's Product-shape checks

## What it checks

AI agents use a product's name, brand, category, and availability status to filter search results and answer availability queries. A Product without a `name` cannot be matched to a catalog entry at all; missing brand, category or availability makes it less likely to surface in filtered AI recommendations.

## Code review findings (2026-08-20, 11-agent pass)

Repeats 3.21's `products[0]`-across-all-pages defect verbatim, and makes `category` — an optional schema.org property that Google does not consume and that neither Shopify nor WooCommerce emit by default — a pass-blocking requirement, so essentially every real store is warned for a non-issue.

**Required fix:** Adopt the same per-product-page selection as the 3.21 fix and report an N/M ratio. Demote `category` from a scored requirement to an advisory suggestion in the message. Resolve `availability` only from Offer nodes (with `@id` reference dereferencing) and stop accepting it on the Product itself. Consider merging the availability portion into 3.24, which already scores the same signal.

**False-positive risks:**

- `const first = products[0]` after `ctx.pages.flatMap(flattenJsonLd)` — identical to 3.21. A hoisted category-page Product stub decides the verdict for the whole site: false `fail` ('Missing critical product details') on stores whose PDPs are complete, or false `pass` when the first stub happens to be rich.
- `if (!first['category']) missing.push('category')` — schema.org `category` is optional, Google's Product structured-data documentation does not list it, and the default output of Shopify, WooCommerce and Magento omits it. The result is a near-universal warn instructing merchants to add a property with no consumer. Invented requirement.
- `let hasAvailability = !!first['availability']` accepts `availability` directly on the Product. That is not a valid schema.org Product property (ItemAvailability belongs on Offer), so the audit rewards incorrect markup and its own test asserts this behaviour as correct.
- `offers.some((o: Record<string, unknown>) => o && o.availability)` casts array elements without a typeof guard; `"offers": "https://site/#offer"` (an @id string reference, valid JSON-LD) yields `undefined` silently, so a site using node references for its offers is scored as having no availability.
- Declared `applicablePageTypes: ['product']` but reads every page.
- `brand` truthiness only — `"brand": {}` passes as a brand.

**Test gaps:**

- No test with multiple Product nodes / category-page stubs (the `[0]` defect)
- No test asserting `category` absence should not block a pass on default Shopify/WooCommerce output
- No test for `offers` given as an `@id` string reference
- No multi-page test distinguishing PDP quality from listing-page quality
- The existing test explicitly encodes `availability` on the Product (rather than the Offer) as a pass, cementing incorrect markup as the expected shape

**Overlaps with:** `3.24`, `3.8`, `3.21`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** Google's product data extractors read `brand`, `category` and the Offer's `availability` from a product page's schema.org markup. `availability` is pulled into Merchant Center and used to correct the item's stock state. A page that omits it leaves the stock state to be inferred rather than read.

**Grade: A** — all three measured properties appear in Google's documented merchant-listing property tables, and `availability` specifically is named in the automatic-item-updates extraction path, which is documented consumer behavior rather than convention.

**Evidence:**

- Merchant listing structured data lists `brand.name`, `category` ("Specifies the product's categories", `Text` or `CategoryCode`) and `offers.availability` among the properties Google reads; required are only Product `name`, `image`, `offers` and the Offer's price/priceCurrency pair — https://developers.google.com/search/docs/appearance/structured-data/merchant-listing (verified 2026-08-21)
- Automatic item updates: "We automatically read the structured data markup on your website using our advanced data extractors and directly pull product data from your HTML into Merchant Center". The covered attributes are price, sale price, `availability` (schema.org `ItemAvailability`) and `itemCondition` — https://support.google.com/merchants/answer/3246284 (verified 2026-08-21)
- "Structured data lets Google and other web platforms automatically read your site and directly pull product data from your HTML"; "Structured data must match the values that are shown to the customer" — https://support.google.com/merchants/answer/6069143 (verified 2026-08-21)
- Agent-side shopping indexes model the same fields: OpenAI's product feed spec makes `availability` (`in_stock`/`out_of_stock`/`pre_order`/`backorder`/`unknown`) and `brand` required fields — https://developers.openai.com/commerce/specs/feed (verified 2026-08-21)
- Product snippets list `brand` among recommended properties — https://developers.google.com/search/docs/appearance/structured-data/product-snippet (verified 2026-08-21)

**Counter-evidence:** The three measured properties are not equally proven. `availability` has an explicit documented extraction-and-use path. `brand` and `category` are only listed as recommended, and no vendor documents a feature that `category` powers — Google's own Product Category codes are a Merchant Center feed attribute. Making `category` pass-blocking therefore exceeds the evidence. (This corrects the code-review note above, which said `category` is absent from Google's Product documentation. It is present, as a recommended property.) schema.org places `availability` on `Offer` rather than on `Product`, so crediting `Product.availability` rewards invalid markup (https://developers.google.com/search/docs/appearance/structured-data/merchant-listing). And Google states of its AI features: "There's also no special schema.org structured data that you need to add" (https://developers.google.com/search/docs/appearance/ai-features, verified 2026-08-21), so the "filtered AI recommendations" framing has no documented consumer; the proven consumer is Google's shopping pipeline.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-21 — evidence graded **A** (availability/brand/category documented in Google's merchant-listing extraction; category the weakest of the three).
- 2026-08-22 — absorbs the Product half of 3.8 (Plan 4, Task 9); the `name` requirement is ported in. Registry count unchanged by this half (net 0 — 3.8's Service half survives as `structured-data/service-schema`).

## Ported from 3.8 (Plan 4, Task 9, 2026-08-22)

v1 3.8 (`service-product-schema`) measured Service and Product shapes through one node list and branched on `isProduct` for the rest of the check. Its required fix sends the Product half here: _"Merge the Product half into 3.22 (Advanced product details), which already checks brand/category/availability on Product nodes and shares the same type list as 3.21/3.24."_ The Service half survives as [`structured-data/service-schema`](./service-schema.md), narrowed to `Service`/`ProfessionalService`; its dossier records the other side of this split.

### What ported: the `name` requirement

3.8 required `name` on the Product node. This audit never checked it — it went straight to brand, category and availability. That gap matters because the three properties this audit already measures are all **recommended** in Google's merchant-listing table, while `name` is one of the four it marks **required** (_"required are only Product `name`, `image`, `offers` and the Offer's price/priceCurrency pair"_, quoted in the Graded evidence section above). A Product with no name cannot be matched to a catalog entry at all, so brand, category and availability have nothing to attach to.

That asymmetry drives the verdict shape, which is otherwise unchanged:

| Product node                                                     | Verdict                               |
| :--------------------------------------------------------------- | :------------------------------------ |
| no Product node at all                                           | `fail` (unchanged)                    |
| no `name`, whatever else is present                              | `fail`, naming `name` first — **new** |
| `name` present, all three of brand/category/availability missing | `fail` (unchanged)                    |
| `name` present, one or two missing                               | `warn` (unchanged)                    |
| all four present                                                 | `pass` (unchanged)                    |

The wider type list (`Product`, `IndividualProduct`, `ProductModel`) is this audit's, and the ported requirement applies across all of it — 3.8's narrower `['Service','Product']` list was itself one of its recorded defects.

### What did not port, and why

- **3.8's `description` requirement.** Its own review recorded this as invented: _"schema.org does not require it and Google's Product guidance does not either. Well-formed Product blocks that omit description are permanently warned for a non-issue."_ Porting it would import a known false positive. A test asserts a complete Product without `description` still passes.
- **3.8's `brand || manufacturer || provider || offers` fallback.** 3.8 accepted an Offer or a provider in place of a brand. `brand` is the property Google's table names, and an Offer is not a brand; accepting one would weaken a check this audit already has right. A test asserts `offers` alone still warns for a missing brand. (`manufacturer` remains accepted — that was already this audit's behaviour, and it is a brand-equivalent.)
- **3.8's `serviceProducts[0]` node selection.** This audit has the identical `products[0]` defect, listed in its own required fix; the split neither fixes nor worsens it (see Deviations).

### Grade decision: stays **A**, tier `scored`, weight 1.0

Both audits were graded **A** on the same commerce-markup record — Google Merchant Center's website crawl and automatic item updates reading Product/Offer markup into the Shopping Graph that AI Mode shopping queries. Absorbing the Product half adds no new consumer and removes none, and the ported property (`name`) sits inside the strongest part of that record, the required-property table. So: **A**, `tier: scored`, `weightForGrade('A', 'scored')` = **1.0**, unchanged. What changes for a scanned site is that a nameless Product is now caught here instead of being warned about, in different words, by a second audit.

### Deviations — standing required-fix items not addressed by this split

- **`products[0]` across all pages is still the selection rule.** Adopting per-product-page selection with an N/M ratio is this audit's own standing required fix (shared with 3.21), not part of the fold; 3.8 had the same defect, so the split neither adds nor removes it. Note the contrast with `service-schema`, where the equivalent clause _was_ in that half's required fix and did land.
- **`category` is still pass-blocking**, though the graded evidence above records it as the weakest of the three and only _recommended_. Demoting it is a separate documented decision, not a port.
- **`Product.availability` is still accepted** even though schema.org puts `ItemAvailability` on `Offer`, and `"offers": "https://site/#offer"` (an `@id` reference) still reads as no availability. Both are pre-existing items on this audit's fix list.
