---
audit: agentic-commerce/product-identifiers
category: agentic-commerce
source_file: packages/core/src/audits/agentic-commerce/product-identifiers.ts
slug: product-identifiers
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - google-merchant-listing
  - google-merchant-identifiers
  - openai-feed-spec-confirm
  - google-product-snippet
  - google-auto-item-updates
  - webalmanac-2024-structured-data
  - google-product-variants
---

# product-identifiers (`3.21`)

> agentic-commerce · source `product-identifiers.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

AI agents use unique identifiers like GTIN, UPC, or MPN to de-duplicate products across different sources and confirm they are looking at the exact item the user wants. Without them, agents may confuse similar products or fail to find specific pricing.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** Product-matching systems that ingest a page's Product markup key on `gtin*`, `mpn` and `sku` to match the page's item to the same item from other sources. Google's merchant listing pipeline works this way, as do feed-based agent catalogues such as OpenAI's ChatGPT shopping index. An item published without any unique identifier cannot be matched with confidence, and loses eligibility for identifier-dependent surfaces.

**Grade: A** — Google documents `gtin`/`gtin8-14`/`isbn`, `mpn` and `sku` as properties it reads from merchant listing structured data, and states plainly that matching fails without them; OpenAI's product feed spec carries the same identifier set for ChatGPT product results.

**Evidence:**

- Google merchant listing structured data lists three recommended Product properties. `gtin | gtin8 | gtin12 | gtin13 | gtin14 | isbn` — "Include all applicable global identifiers". `mpn` — identifies "the product for a given manufacturer". `sku` — "the merchant-specific identifier for the product" — https://developers.google.com/search/docs/appearance/structured-data/merchant-listing (verified 2026-08-21)
- Google on unique product identifiers: "Accurate matching to products can't be assured when GTIN is missing." It adds that "Products submitted without any unique product identifiers are difficult to classify and may not be eligible for all Shopping programs or features". It states that GTIN is "strongly recommended for all products with a GTIN assigned by the manufacturer" — https://support.google.com/merchants/answer/6324461 (verified 2026-08-21)
- OpenAI's product feed spec requires `item_id` — "Merchant product ID (unique per variant)". It carries an optional `gtin` — "Universal product identifier", GTIN/UPC/ISBN, 8-14 digits — and `mpn`, max 70 characters — the identifier set an agent shopping index actually stores — https://developers.openai.com/commerce/specs/feed (verified 2026-08-21)
- Product snippets list product identifiers (SKU, GTIN, MPN) among the recommended properties Google parses — https://developers.google.com/search/docs/appearance/structured-data/product-snippet (verified 2026-08-21)

**Counter-evidence:** Identifiers are _recommended_, never required, in every structured-data spec checked, and Google notes that store-brand, private-label and customized products legitimately have no GTIN — so a hard fail is stronger than any vendor's guidance (https://support.google.com/merchants/answer/6324461). Google's automatic item updates cover only price, sale price, availability and condition — identifiers are not part of that page-crawl extraction (https://support.google.com/merchants/answer/3246284). The strongest agent-side consumer path (OpenAI/ACP) receives identifiers through a merchant feed or API rather than by parsing page markup (https://developers.openai.com/commerce/, https://www.agenticcommerce.dev/, verified 2026-08-21). Product markup adoption itself is thin: `Product` appears on 0.77% of crawled mobile pages (https://almanac.httparchive.org/en/2024/structured-data).

## Implementation deviations

- Products come from the shared `resolveProducts` in
  `packages/core/src/product-schema.ts`. Each `ProductGroup` variant is read
  with the group's shared properties beneath its own. A `ProductGroup` with no
  variants is read as the product.
