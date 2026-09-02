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
---

# product-transaction-certainty (`3.24`)

> agentic-commerce · source `product-transaction-certainty.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

AI shopping assistants need more than a product name and price to make an authoritative recommendation. Before they commit a user to a purchase, they must know whether the item is in stock, how long the quoted price is valid, and what the return policy is. A Product schema that only carries name and price forces agents to guess at availability, quote potentially stale prices, and stay silent on returns — all of which erode transactional certainty in agentic commerce flows. Complete your Offer with availability, priceValidUntil, and a valid price + priceCurrency pair, and attach hasMerchantReturnPolicy to the Product or Offer.

## Code review findings (2026-08-20, 11-agent pass)

The most thoughtfully-built product audit in the category — it correctly returns notApplicable when no Product exists and names the missing signals — but it reports the BEST product on the site as the site's verdict (so one showcase product masks a whole catalogue) and makes priceValidUntil a pass-blocking requirement, which is advice most merchants should not follow.

**Required fix:** Score per product page and report the median/worst coverage plus an N/M ratio, not the best product on the site — a site-wide claim must be backed by site-wide data. Evaluate the four signals against a SINGLE Offer object rather than OR-ing `some()` across variants. Move `priceValidUntil` out of the pass-blocking set into an advisory note (or replace it with a check that any present `priceValidUntil` is not already in the past, which is the actually-useful version). Make `hasMerchantReturnPolicy` conditional on the page being a merchant listing.

**False-positive risks:**

- `if (!best || count > best.count) best = { signals, count }` selects the single best-covered Product across all pages and reports it as the verdict. A store with one immaculately-marked hero product and 4,999 bare ones is reported as 4/4 certainty signals at high priority — the customer is actively reassured about a catalogue that is not agent-ready. The commented rationale ('so one complete listing is not dragged down by sparse siblings') optimizes for a flattering number rather than an accurate one.
- `priceValidUntil` is 1 of the 4 required signals. schema.org and Google both treat it as optional, and Google will DROP the price from rich results once the date passes — so maintaining it is a liability for live commerce and most merchants are correctly advised not to set it. A perfectly-marked store can therefore never reach 4/4 without adding a field it should not maintain. Invented criterion presented as a certainty requirement.
- `offers.some(...)` is evaluated INDEPENDENTLY per signal, so a Product whose variant A has `availability` and whose variant B has `priceValidUntil` scores 2/4 even though no single purchasable Offer carries both. The score overstates the completeness of any actual offer an agent would act on.
- `hasMerchantReturnPolicy` is required, but it is a merchant-listing property; a manufacturer spec page, a marketplace listing, or a service product legitimately has none, and those pages are pushed toward `warn`/`fail` at high priority.
- Like its siblings it flattens all pages, so hoisted `itemListElement` Product stubs are candidates — harmless here because it takes the best, but it means the reported product may not be the page's primary entity.
- `pricePair` duplicates 3.14's entire check, and `availability` duplicates 3.22's third check, so a site missing offers is penalized three times across the category.

**Test gaps:**

- No test with multiple Products of differing completeness (the best-of masking behaviour is never exercised)
- No test where signals are split across different variant Offers (`some()` over-crediting)
- No test asserting a store without `priceValidUntil` should still be able to reach a full pass
- No test for `ProductGroup` + `hasVariant[].offers`
- No test for `offers` as an `@id` reference
- No multi-page test distinguishing catalogue-wide coverage from a single showcase product

**Overlaps with:** `3.14`, `3.22`, `3.21`

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

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-21 — evidence graded **A** (each measured Offer property has documented Google extraction behavior; the 4/4 composite and the priceValidUntil requirement do not).
