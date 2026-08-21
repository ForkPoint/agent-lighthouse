---
audit: structured-data/product-transaction-certainty
audit_id: "3.24"
category: structured-data
source_file: packages/core/src/audits/structured-data/product-transaction-certainty.ts
slug: product-transaction-certainty
review_verdict: fix
severity: medium
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# product-transaction-certainty (`3.24`)

> structured-data · source `product-transaction-certainty.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

AI shopping assistants need more than a product name and price to make an authoritative recommendation: they must know whether the item is in stock, how long the quoted price is valid, and what the return policy is before they commit a user to a purchase. A Product schema that only carries name and price forces agents to guess at availability, quote potentially stale prices, and stay silent on returns — all of which erode transactional certainty in agentic commerce flows. Complete your Offer with availability, priceValidUntil, and a valid price + priceCurrency pair, and attach hasMerchantReturnPolicy to the Product or Offer.

## Code review findings (2026-08-20, 11-agent pass)

The most thoughtfully-built product audit in the category — it correctly returns notApplicable when no Product exists and names the missing signals — but it reports the BEST product on the site as the site's verdict (so one showcase product masks a whole catalogue) and makes priceValidUntil a pass-blocking requirement, which is advice most merchants should not follow.

**Required fix:** Score per product page and report the median/worst coverage plus an N/M ratio, not the best product on the site — a site-wide claim must be backed by site-wide data. Evaluate the four signals against a SINGLE Offer object rather than OR-ing `some()` across variants. Move `priceValidUntil` out of the pass-blocking set into an advisory note (or replace it with a check that any present `priceValidUntil` is not already in the past, which is the actually-useful version). Make `hasMerchantReturnPolicy` conditional on the page being a merchant listing.

**False-positive risks:**
- `if (!best || count > best.count) best = { signals, count }` selects the single best-covered Product across ALL pages and reports it as the verdict. A store with one immaculately-marked hero product and 4,999 bare ones is reported as 4/4 certainty signals at high priority — the customer is actively reassured about a catalogue that is not agent-ready. The commented rationale ('so one complete listing is not dragged down by sparse siblings') optimizes for a flattering number rather than an accurate one.
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

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
