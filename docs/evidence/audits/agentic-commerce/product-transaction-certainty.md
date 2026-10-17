---
audit: agentic-commerce/product-transaction-certainty
category: agentic-commerce
source_file: packages/core/src/audits/agentic-commerce/product-transaction-certainty.ts
slug: product-transaction-certainty
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - google-merchant-listing
  - google-auto-item-updates
  - google-product-snippet
  - openai-feed-spec-confirm
  - agentic-commerce-protocol
  - google-merchant-spec
  - openai-commerce-index
  - google-ai-features-trust
  - google-product-variants
---

# product-transaction-certainty (`3.24`)

> agentic-commerce · source `product-transaction-certainty.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

AI shopping assistants need more than a product name and price to make an authoritative recommendation. Before they commit a user to a purchase, they must know whether the item is in stock, how long the quoted price is valid, and what the return policy is. A Product schema that only carries name and price forces agents to guess at availability, quote potentially stale prices, and stay silent on returns — all of which erode transactional certainty in agentic commerce flows. Complete your Offer with availability, priceValidUntil, and a valid price + priceCurrency pair, and attach hasMerchantReturnPolicy to the Product or Offer.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** Google's merchant-listing structured-data spec names all four measured Offer properties — `price` with `priceCurrency`, `availability`, `priceValidUntil` and `hasMerchantReturnPolicy` — as properties its extractors read from the page. Google also acts on them: price and availability are pulled into Merchant Center by automatic item updates, and a `priceValidUntil` date in the past suppresses the product snippet. An Offer missing them therefore yields a listing whose stock state, price validity and return terms cannot be machine-read.

**Grade: A** — every property in the measured bundle has documented consumer behavior from a named vendor pipeline, with `price`/`priceCurrency` required and the other three documented as read.

**Evidence:**

- Merchant listing structured data requires Product `name`, `image` and `offers`, and on the Offer, `price` (or `priceSpecification.price`) and `priceCurrency`. It recommends and parses three more: `availability`, `priceValidUntil` ("The date and time after which the price will no longer be available") and `hasMerchantReturnPolicy` ("Nested information about the return policies associated with an `Offer`") — https://developers.google.com/search/docs/appearance/structured-data/merchant-listing (verified 2026-08-21)
- Automatic item updates read the markup off the page: "We automatically read the structured data markup on your website using our advanced data extractors and directly pull product data from your HTML into Merchant Center." The fields covered are price, sale price, `availability` and `itemCondition` — https://support.google.com/merchants/answer/3246284 (verified 2026-08-21)
- Google acts on `priceValidUntil`: "Your product snippet may not display if the `priceValidUntil` property indicates a past date" — https://developers.google.com/search/docs/appearance/structured-data/product-snippet (verified 2026-08-21)
- The same transactional fields are what an agent checkout surface stores: OpenAI's product feed spec makes `price` (number + ISO 4217 currency) and `availability` required, and requires `return_policy` (return policy URL) when `is_eligible_checkout` is true — https://developers.openai.com/commerce/specs/feed (verified 2026-08-21)
- Agentic Commerce Protocol, "developed by Stripe and OpenAI" as an open standard for agent-initiated checkout, is the emerging transaction path these fields feed — https://www.agenticcommerce.dev/ (verified 2026-08-21)
- Merchant Center price guidance requires the page's structured data to agree with the displayed and checkout price — https://support.google.com/merchants/answer/7052112 (verified 2026-08-21)

**Counter-evidence:** The documented behavior around `priceValidUntil` argues against requiring it. Google treats it as optional, and _suppresses_ the snippet once the date passes, so an unmaintained date is worse than none. The audit's 4/4 pass gate therefore pushes merchants toward a field that can cost them the very listing it is supposed to secure (https://developers.google.com/search/docs/appearance/structured-data/product-snippet). `hasMerchantReturnPolicy` is a merchant-listing property, not a universal Product property, and Google prefers organization-level return policies over per-offer ones (https://developers.google.com/search/docs/appearance/structured-data/merchant-listing). No AI-assistant vendor documents reading this bundle from page markup. OpenAI ingests price, availability and return policy through a merchant feed or API: "Provide a structured product feed so ChatGPT accurately indexes and displays your products with up-to-date price and availability" (https://developers.openai.com/commerce/). Google states of its AI features that "There's also no special schema.org structured data that you need to add" (https://developers.google.com/search/docs/appearance/ai-features, verified 2026-08-21). The four-signal "transactional certainty" composite is this project's construct; the evidence supports the individual properties, not the bundle as a threshold.

## Implementation deviations

- **ProductGroup variants are read as products.** Products come from the
  shared `resolveProducts` in `packages/core/src/product-schema.ts`. Each
  `hasVariant` entry (or a Product joined through `isVariantOf` or
  `inProductGroupWithID`) is read with the group's shared properties beneath
  its own, as Google's product variant documentation lays them out
  (https://developers.google.com/search/docs/appearance/structured-data/product-variants,
  verified 2026-10-09). A `ProductGroup` with no variants is read as the
  product. Before this, a brand or category declared once on the group was
  invisible, and a page whose only top-level product was a `ProductGroup`
  read as having no product.
