---
audit: machine-discovery/agent-commerce-feed-parity
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/agent-commerce-feed-parity.ts
slug: agent-commerce-feed-parity
evidence_grade: A
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-22"
reviewed: 2026-08-20
graduated: 2026-08-22
sources:
  - openai-feed-spec-confirm
  - openai-commerce-index
  - google-merchant-spec
  - google-auto-item-updates
---

# Agent-commerce feed-field parity from product-page structured data

> Shipped in v2. Evidence grade **A** · scored tier · unique · implementation: `multi-page`

## What it checks

Audits sampled product pages against the union of OpenAI's Product Feed Spec required fields and Google Merchant Center's required attributes. The PDP's JSON-LD is the auditable proxy for feed eligibility. The union includes the fields that Google's rich-result validator does not require, and that therefore no SEO tool checks.

## Claimed mechanism (falsifiable)

Google's automatic item updates repairs feed and page discrepancies 'using the structured data markup the crawlers find on your website'. It requires price with priceCurrency, availability as a valid ItemAvailability, and itemCondition mapped to NewCondition, RefurbishedCondition or UsedCondition. It states that when extractors cannot determine those, 'your products will be subject to item-level disapprovals'. Merchant Center separately requires that feed availability 'must match the availability from your landing page' and that price 'must match landing page and checkout prices'. OpenAI's Product Feed Spec requires a strictly larger per-item set than Google's rich-result minimum. It requires a stable item_id of at most 100 characters, a brand of at most 70, a seller_name, target_countries as ISO 3166-1 alpha-2, a plain-text description of at most 5000 characters, and availability from a fixed lowercase enum, price with ISO 4217 currency, and is_eligible_search/is_eligible_checkout. Falsifiable claim: a PDP missing brand, seller, itemCondition-as-URL, a stable SKU, or a country or region signal will pass every Google rich-result test. It still cannot be reconciled by automatic item updates, and it provides no page-side evidence for the fields OpenAI's feed requires. Feed rejections and item-level disapprovals are therefore silent and unattributable. A second claim is sharply testable. When the JSON-LD offers.price disagrees with the price rendered in the page HTML, automatic item updates will overwrite the feed with one of the two values. An agent reading the page will quote the other.

## Evidence

- **[OpenAI Commerce — Product Feed Spec](https://developers.openai.com/commerce/specs/feed/)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Required per item: item_id (stable, unique per variant, max 100 chars), title, description (max 5000, plain text only), link or url (must resolve HTTP 200), image_url (JPEG or PNG). Also required are price with an ISO 4217 currency, brand (max 70), seller_name and target_countries (ISO 3166-1 alpha-2). availability is drawn from the lowercase enum {in_stock,out_of_stock,pre_order,backorder,unknown}. Two booleans complete the set: is_eligible_search, and is_eligible_checkout, which requires is_eligible_search=true. Optional/recommended: gtin (8-14 digits, no dashes), mpn (max 70), condition, item_group_id (stable across variants). sale_price must be <= price. Accepted formats are delimited files only (TSV/CSV/.txt + gzip); 'JSON, spreadsheet, XML, RSS, and Atom sources are not part of this compatibility path.' No documented refresh-cadence requirement.
- **[OpenAI Commerce (overview)](https://developers.openai.com/commerce/)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Three feed delivery paths: API create/retrieve/upsert of product + promotion feed data, SFTP file upload, and legacy file upload. Feed conformance is what lets 'ChatGPT accurately index and display your products with up-to-date price and availability.' Checkout requires the Agentic Checkout Spec. Page does not document schema.org markup as an alternative ingestion path.
- **[Product data specification](https://support.google.com/merchants/answer/7052112)** — Google Merchant Center (vendor-doc, URL verified 2026-08-20)
  - Required attributes:
    - `id` — max 50 characters, unique.
    - `title` — max 150 characters.
    - `description` — max 5000 characters, 'should match landing page content'.
    - `link`.
    - `image_link` — 500x500 minimum, enforced 2027-01-31.
    - `brand` — max 70 characters.
  - `availability` is drawn from {in_stock,out_of_stock,preorder,backorder}, and 'must match the availability from your landing page'. `price` 'must match landing page and checkout prices'.
  - `gtin` is strongly recommended. `mpn` is required when there is no manufacturer GTIN. `condition` is required for used or refurbished items. `item_group_id` is required for variants in BR/FR/DE/JP/UK/US.
- **[Automatic item updates](https://support.google.com/merchants/answer/3246284)** — Google Merchant Center (vendor-doc, URL verified 2026-08-20)
  - Google repairs feed/landing-page discrepancies 'using the structured data markup the crawlers find on your website'. Required markup: price + priceCurrency (or priceSpecification), availability with valid ItemAvailability values, itemCondition mapped to NewCondition/RefurbishedCondition/UsedCondition. When markup is missing, ML 'advanced data extractors' run instead, and 'if the extractors are unable to determine price availability, or condition information, your products will be subject to item-level disapprovals.' This makes PDP structured data an auditable proxy for feed eligibility.

## Example failure

A Shopify store's Product JSON-LD emits `"availability": "InStock"` — a bare token, not the schema.org URL. It omits `itemCondition` and `offers.seller`. It renders the sale price in the DOM via a currency-conversion script, so the JSON-LD says 49.00 USD while the visible price is 42.00 USD. Google's Rich Results Test passes. Automatic item updates cannot parse availability or condition. It falls back to ML extractors, and item-level disapprovals begin. Separately, the OpenAI feed is rejected on brand and seller_name. An agent reading the page quotes 49.00 to a shopper who is charged 42.00 — or the reverse.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Implementation deviations

- **Kept apart from `agentic-commerce/checkout-offer-field-mapping`.** That
  audit checks one scanned product page. This one reports per-field pass rates
  and the agent-commerce gap across a sitemap sample.
- **Subpath sitemap scope.** On a subpath homepage, the shared sitemap gatherer
  treats that directory as the site root. It keeps only same-origin URLs under
  it, before the entry cap and sampling. A sibling-only sitemap does not count.
  Origin files, probes and feed discovery keep origin scope.
- **Deterministic sample.** `sampleEntries` takes an even stride of 6 sitemap
  URLs, so a re-scan opens the same pages.
- **Identity stability is not re-fetched.** The audit checks presence, the
  character cap and the GTIN check digit. A second GET per page would double
  the request budget.
- **`ISO_4217` is a bundled set of active codes**, not a `/^[A-Z]{3}$/` regex.
- **Currency parsing handles both decimal conventions.** `1.234,56` and
  `1,234.56` both read as 1234.56.
- **Price parity reads the whole rendered body**, with `script`, `style`,
  `template` and `noscript` removed. That keeps the JSON-LD price out of the
  comparison set.
- **Image media type.** At most 2 images per scan get a HEAD request. The rest
  are judged by extension. A type outside JPEG/PNG is a risk, not a defect.
- **Sibling variants** are a `hasVariant` array with more than one entry, or a
  variant-named `<select>` with more than one `<option>`.
- **JSON-LD shapes.** Image reads a string, an array, or an `ImageObject`'s
  `url` or `contentUrl`. Price reads `offers.price`, then `lowPrice`, then the
  first `hasVariant` offer. Item group accepts `productGroupID`,
  `inProductGroupWithID` or `isVariantOf`.
- **Seller `@id` references** resolve against nodes on the same page. A
  dangling reference fails, and the message names it.
- **`is_eligible_search` / `is_eligible_checkout` are not inferred.** Both are
  merchant policy, not page evidence.
- **Sale-versus-list price sanity** is left to
  `agentic-commerce/checkout-offer-field-mapping`, to avoid counting one defect
  twice.

## Deferred

- **Country names are not mapped.** Only alpha-2 shapes resolve. "United
  States" reads as a missing signal.
- **Client-side variant controls are not seen.** Sampled pages are not
  rendered, so a JavaScript-built selector reads as a single variant.
