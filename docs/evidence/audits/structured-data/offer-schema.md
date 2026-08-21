---
audit: structured-data/offer-schema
audit_id: "3.14"
category: structured-data
source_file: packages/core/src/audits/structured-data/offer-schema.ts
slug: offer-schema
review_verdict: fix
severity: high
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# offer-schema (`3.14`)

> structured-data · source `offer-schema.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

AI agents use Offer schema to answer pricing queries with exact numbers. Without price and priceCurrency in structured data, agents must scrape and guess pricing from page text, which often produces inaccurate or outdated results in AI-generated comparisons.

## Code review findings (2026-08-20, 11-agent pass)

Price and currency in structured data is one of the few schema signals with clear agentic-commerce value, but a short-circuit bug makes the audit judge a stray hoisted Offer node instead of the product's real offer, and it rejects the schema.org-correct AggregateOffer lowPrice/highPrice form used by every multi-variant product.

**Required fix:** Remove the short-circuit: evaluate whether ANY Offer reachable from the page's primary Product satisfies price+currency, rather than testing only the first hoisted Offer node. Accept `AggregateOffer` with `lowPrice`/`highPrice` as satisfying the price requirement. Add an explicit `/pricing|/plans|/preise|/tarifs` URL fallback so SaaS pricing pages are actually assessed, matching the audit's title.

**False-positive risks:**
- `if (hasOfferSchema) { const first = schemas.find(isOffer); return first['price'] !== undefined && !!first['priceCurrency']; }` short-circuits and NEVER evaluates `hasOfferProp`. Because `flattenJsonLd` hoists nested Offers, `schemas.find(isOffer)` returns whichever Offer appears first in DFS order — commonly a related-products carousel Offer, a `seller`-only Offer stub, or a ProductGroup variant Offer. If that stray offer lacks price/priceCurrency the page is failed even though the primary Product's `offers` block is complete. Concrete, high-frequency false fail on Shopify ProductGroup/hasVariant markup.
- `offerObj['price'] !== undefined && offerObj['priceCurrency']` rejects `AggregateOffer` with `lowPrice`/`highPrice`/`offerCount` and no `price` — the schema.org-canonical form for a variant price range. Multi-variant products marked up correctly are failed.
- The applicability gate `p.pageType === 'product'` inherits `detectPageType`'s loose heuristics: any page with an `[class*="add-to-cart"]` element and a `.price` element is typed 'product' (parser.ts:541-551), so category pages and homepages with product carousels are mis-typed and then failed for lacking Offer schema.
- The audit is titled 'Offer schema on pricing pages' and the inline comment claims the product-type gate 'already covers SaaS pricing pages' — but `detectPageType` has no `/pricing` or `/plans` rule and SaaS pricing pages have no add-to-cart markup, so they are typed 'content' and the audit returns `na`. The audit does not do what its own title says.
- `price: 0` is accepted (`!== undefined`), so a free-tier Offer passes, while `price: "0.00"` on a broken template also passes — no sanity check on the value.

**Test gaps:**
- No test where a stray/nested Offer precedes the product's real offers (the short-circuit bug)
- No test for `AggregateOffer` with `lowPrice`/`highPrice`
- No test for `ProductGroup` + `hasVariant[].offers`
- No test for a SaaS `/pricing` page (which the audit claims to cover but returns `na` on)
- No test for a category page mis-typed as 'product' by detectPageType

**Overlaps with:** `3.24`, `3.22`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
