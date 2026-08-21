---
audit: structured-data/product-details
audit_id: "3.22"
category: structured-data
source_file: packages/core/src/audits/structured-data/product-details.ts
slug: product-details
review_verdict: fix
severity: medium
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# product-details (`3.22`)

> structured-data · source `product-details.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

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

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
