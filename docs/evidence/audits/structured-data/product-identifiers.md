---
audit: structured-data/product-identifiers
audit_id: "3.21"
category: structured-data
source_file: packages/core/src/audits/structured-data/product-identifiers.ts
slug: product-identifiers
review_verdict: fix
severity: high
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# product-identifiers (`3.21`)

> structured-data · source `product-identifiers.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

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

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
