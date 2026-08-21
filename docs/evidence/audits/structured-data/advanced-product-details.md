---
audit: structured-data/advanced-product-details
audit_id: "3.22"
category: structured-data
source_file: packages/core/src/audits/structured-data/advanced-product-details.ts
slug: advanced-product-details
review_verdict: fix
severity: medium
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# product-details (`3.22`)

> structured-data · source `product-details.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

AI agents use brand, category, and availability status to filter search results and answer availability queries. Missing these details makes your products less likely to surface in filtered AI recommendations.

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

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Graded evidence (2026-08-21)

**Mechanism claim:** Google's product data extractors read `brand`, `category` and the Offer's `availability` from a product page's schema.org markup; `availability` is pulled into Merchant Center and used to correct the item's stock state, so a page that omits it leaves the stock state to be inferred rather than read.

**Grade: A** — all three measured properties appear in Google's documented merchant-listing property tables, and `availability` specifically is named in the automatic-item-updates extraction path, which is documented consumer behavior rather than convention.

**Evidence:**
- Merchant listing structured data lists `brand.name`, `category` ("Specifies the product's categories", `Text` or `CategoryCode`) and `offers.availability` among the properties Google reads; required are only Product `name`, `image`, `offers` and the Offer's price/priceCurrency pair — https://developers.google.com/search/docs/appearance/structured-data/merchant-listing (verified 2026-08-21)
- Automatic item updates: "We automatically read the structured data markup on your website using our advanced data extractors and directly pull product data from your HTML into Merchant Center", with the covered attributes being price, sale price, `availability` (schema.org `ItemAvailability`) and `itemCondition` — https://support.google.com/merchants/answer/3246284 (verified 2026-08-21)
- "Structured data lets Google and other web platforms automatically read your site and directly pull product data from your HTML"; "Structured data must match the values that are shown to the customer" — https://support.google.com/merchants/answer/6069143 (verified 2026-08-21)
- Agent-side shopping indexes model the same fields: OpenAI's product feed spec makes `availability` (`in_stock`/`out_of_stock`/`pre_order`/`backorder`/`unknown`) and `brand` required fields — https://developers.openai.com/commerce/specs/feed (verified 2026-08-21)
- Product snippets list `brand` among recommended properties — https://developers.google.com/search/docs/appearance/structured-data/product-snippet (verified 2026-08-21)

**Counter-evidence:** The three measured properties are not equally proven. `availability` has an explicit documented extraction-and-use path; `brand` and `category` are only listed as recommended, and no vendor documents a feature that `category` powers — Google's own Product Category codes are a Merchant Center feed attribute, so making `category` pass-blocking exceeds the evidence (this corrects the code-review note above, which stated `category` is absent from Google's Product documentation: it is present, as a recommended property). schema.org places `availability` on `Offer`, not on `Product`, so crediting `Product.availability` rewards invalid markup (https://developers.google.com/search/docs/appearance/structured-data/merchant-listing). And Google states of its AI features: "There's also no special schema.org structured data that you need to add" (https://developers.google.com/search/docs/appearance/ai-features, verified 2026-08-21), so the "filtered AI recommendations" framing has no documented consumer; the proven consumer is Google's shopping pipeline.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-21 — evidence graded **A** (availability/brand/category documented in Google's merchant-listing extraction; category the weakest of the three).
