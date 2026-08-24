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
---

# product-identifiers (`3.21`)

> agentic-commerce · source `product-identifiers.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

AI agents use unique identifiers like GTIN, UPC, or MPN to de-duplicate products across different sources and confirm they are looking at the exact item the user wants. Without them, agents may confuse similar products or fail to find specific pricing.

## Code review findings (2026-08-20, 11-agent pass)

GTIN/SKU/MPN is a genuinely important agentic-commerce signal, but the audit collapses the entire site to `products[0]` — the first Product node in DFS order across every scanned page — so on any scan that includes a category page or a homepage carousel it judges a listing tile stub and hard-fails at high priority. It also does no validation of the identifier it finds.

**Required fix:** Evaluate per product page: for each `pageType === 'product'` page, select the Product node whose `url`/`@id`/`mainEntityOfPage` matches that page (or the top-level Product, ignoring hoisted `itemListElement` stubs), and report an N/M ratio like the breadcrumb and offer audits. Add the `identifier` PropertyValue form to the accepted list, reject obvious placeholder values, and validate GTIN length (8/12/13/14) plus the GS1 check digit before claiming GTIN coverage.

**False-positive risks:**
- `const first = products[0]` after flattening ALL pages. `flattenJsonLd` hoists `ItemList.itemListElement[].item` Product stubs, and a category page emits 24-48 of them before any real PDP is reached. Those stubs carry `name`+`url` only, so the audit returns a hard `fail` 'No unique product identifiers (GTIN, SKU, MPN) found' at high priority on a store where every PDP has a SKU. This is the most damaging false fail among the product audits.
- The inverse is equally wrong: if the first hoisted Product happens to have a `sku`, the audit passes and never inspects the other N products. A catalogue where one product has a SKU and 500 do not is reported as passing.
- No value validation. `sku: "N/A"`, `sku: "undefined"`, `gtin13: "0000000000000"`, or a 5-digit string in `gtin13` all pass. The audit's title promises GTIN/UPC handling but never checks length or the GS1 check digit.
- The identifier list omits schema.org's `identifier` PropertyValue form (`"identifier": {"@type":"PropertyValue","propertyID":"gtin13","value":"…"}`), which Google accepts — sites using it are failed. `isbn` (Book products) is also missing.
- Declared `applicablePageTypes: ['product']` but collects schemas from every page, so homepage/category Product nodes decide a product-page audit.
- Reports a single global verdict, unlike breadcrumb/offer/faqpage which report an N/M ratio, so a partially-marked catalogue is indistinguishable from a fully-marked or fully-unmarked one.

**Test gaps:**
- No test with a category page containing multiple hoisted Product stubs — the primary false fail is unreachable in tests
- No multi-page test where PDPs have SKUs but a listing page does not
- No test for placeholder identifier values ('N/A', empty-ish strings)
- No GTIN length / check-digit test despite the audit title
- No test for the `identifier` PropertyValue form
- No Microdata test (`productID` was added specifically for Microdata but `structuredData` is never populated in tests)

**Overlaps with:** `3.22`, `3.24`, `3.8`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Evidence (2026-08-21)

**Mechanism claim:** Product-matching systems that ingest a page's Product markup (Google's merchant listing pipeline, and feed-based agent catalogues such as OpenAI's ChatGPT shopping index) key on `gtin*`/`mpn`/`sku` to match the page's item to the same item from other sources, so an item published without any unique identifier cannot be matched with confidence and loses eligibility for identifier-dependent surfaces.

**Grade: A** — Google documents `gtin`/`gtin8-14`/`isbn`, `mpn` and `sku` as properties it reads from merchant listing structured data, and states plainly that matching fails without them; OpenAI's product feed spec carries the same identifier set for ChatGPT product results.

**Evidence:**
- Google merchant listing structured data lists `gtin | gtin8 | gtin12 | gtin13 | gtin14 | isbn` ("Include all applicable global identifiers"), `mpn` (identifies "the product for a given manufacturer") and `sku` ("the merchant-specific identifier for the product") as recommended Product properties — https://developers.google.com/search/docs/appearance/structured-data/merchant-listing (verified 2026-08-21)
- Google on unique product identifiers: "Accurate matching to products can't be assured when GTIN is missing"; "Products submitted without any unique product identifiers are difficult to classify and may not be eligible for all Shopping programs or features"; GTIN is "strongly recommended for all products with a GTIN assigned by the manufacturer" — https://support.google.com/merchants/answer/6324461 (verified 2026-08-21)
- OpenAI's product feed spec requires `item_id` ("Merchant product ID (unique per variant)") and carries optional `gtin` ("Universal product identifier", GTIN/UPC/ISBN, 8-14 digits) and `mpn` (max 70 chars) — the identifier set an agent shopping index actually stores — https://developers.openai.com/commerce/specs/feed (verified 2026-08-21)
- Product snippets list product identifiers (SKU, GTIN, MPN) among the recommended properties Google parses — https://developers.google.com/search/docs/appearance/structured-data/product-snippet (verified 2026-08-21)

**Counter-evidence:** Identifiers are *recommended*, never required, in every structured-data spec checked, and Google notes that store-brand, private-label and customized products legitimately have no GTIN — so a hard fail is stronger than any vendor's guidance (https://support.google.com/merchants/answer/6324461). Google's automatic item updates cover only price, sale price, availability and condition — identifiers are not part of that page-crawl extraction (https://support.google.com/merchants/answer/3246284). The strongest agent-side consumer path (OpenAI/ACP) receives identifiers through a merchant feed or API rather than by parsing page markup (https://developers.openai.com/commerce/, https://www.agenticcommerce.dev/, verified 2026-08-21). Product markup adoption itself is thin: `Product` appears on 0.77% of crawled mobile pages (https://almanac.httparchive.org/en/2024/structured-data).

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-21 — evidence graded **A** (documented identifier consumption by Google merchant listings and OpenAI's product feed spec).
