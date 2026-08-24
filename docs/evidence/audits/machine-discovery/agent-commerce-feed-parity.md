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

Audits sampled product pages against the union of OpenAI's Product Feed Spec required fields and Google Merchant Center's required attributes, using the PDP's JSON-LD as the auditable proxy for feed eligibility — including the fields that Google's rich-result validator does not require and therefore no SEO tool checks.

## Claimed mechanism (falsifiable)

Google's automatic item updates repairs feed/page discrepancies 'using the structured data markup the crawlers find on your website', requires price+priceCurrency, availability as valid ItemAvailability, and itemCondition mapped to New/Refurbished/UsedCondition, and states that when extractors cannot determine those, 'your products will be subject to item-level disapprovals'. Merchant Center separately requires that feed availability 'must match the availability from your landing page' and that price 'must match landing page and checkout prices'. OpenAI's Product Feed Spec requires a strictly larger per-item set than Google's rich-result minimum: stable item_id (<=100 chars), brand (<=70), seller_name, target_countries as ISO 3166-1 alpha-2, plain-text description <=5000, availability from a fixed lowercase enum, price with ISO 4217 currency, and is_eligible_search/is_eligible_checkout. Falsifiable claim: a PDP missing brand, seller, itemCondition-as-URL, a stable SKU, or a country/region signal will pass every Google rich-result test yet cannot be reconciled by automatic item updates and provides no page-side evidence for the fields OpenAI's feed requires — so feed rejections and item-level disapprovals are silent and unattributable. A second, sharply testable claim: when the JSON-LD offers.price disagrees with the price rendered in the page HTML, automatic item updates will overwrite the feed with one of the two values and an agent reading the page will quote the other.

## Evidence

- **[OpenAI Commerce — Product Feed Spec](https://developers.openai.com/commerce/specs/feed/)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Required per item: item_id (stable, unique per variant, max 100 chars), title, description (max 5000, plain text only), link/url (must resolve HTTP 200), image_url (JPEG/PNG), price with ISO 4217 currency, availability from lowercase enum {in_stock,out_of_stock,pre_order,backorder,unknown}, brand (max 70), seller_name, target_countries (ISO 3166-1 alpha-2), is_eligible_search (bool), is_eligible_checkout (bool, requires is_eligible_search=true). Optional/recommended: gtin (8-14 digits, no dashes), mpn (max 70), condition, item_group_id (stable across variants). sale_price must be <= price. Accepted formats are delimited files only (TSV/CSV/.txt + gzip); 'JSON, spreadsheet, XML, RSS, and Atom sources are not part of this compatibility path.' No documented refresh-cadence requirement.
- **[OpenAI Commerce (overview)](https://developers.openai.com/commerce/)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Three feed delivery paths: API create/retrieve/upsert of product + promotion feed data, SFTP file upload, and legacy file upload. Feed conformance is what lets 'ChatGPT accurately index and display your products with up-to-date price and availability.' Checkout requires the Agentic Checkout Spec. Page does not document schema.org markup as an alternative ingestion path.
- **[Product data specification](https://support.google.com/merchants/answer/7052112)** — Google Merchant Center (vendor-doc, URL verified 2026-08-20)
  - Required: id (max 50, unique), title (max 150), description (max 5000, 'should match landing page content'), link, image_link (500x500 min enforced 2027-01-31), availability from {in_stock,out_of_stock,preorder,backorder} and it 'must match the availability from your landing page', price which 'must match landing page and checkout prices', brand (max 70). gtin strongly recommended; mpn required when no manufacturer GTIN; condition required if used/refurbished; item_group_id required for variants in BR/FR/DE/JP/UK/US.
- **[Automatic item updates](https://support.google.com/merchants/answer/3246284)** — Google Merchant Center (vendor-doc, URL verified 2026-08-20)
  - Google repairs feed/landing-page discrepancies 'using the structured data markup the crawlers find on your website'. Required markup: price + priceCurrency (or priceSpecification), availability with valid ItemAvailability values, itemCondition mapped to NewCondition/RefurbishedCondition/UsedCondition. When markup is missing, ML 'advanced data extractors' run instead, and 'if the extractors are unable to determine price availability, or condition information, your products will be subject to item-level disapprovals.' This makes PDP structured data an auditable proxy for feed eligibility.

## Competitor coverage

Google Rich Results Test, Schema Markup Validator, Semrush and Ahrefs all validate against Google's merchant-listing rich-result requirements (name, image, offers.price, priceCurrency, availability) and stop there. None validate against the OpenAI Product Feed Spec field set, none check ISO 4217/3166 code validity, none check itemCondition-as-URL or seller presence, and none perform JSON-LD-vs-rendered-price parity. Lighthouse's agentic category has no commerce checks.

## Implementation sketch

Detect PDPs (JSON-LD @type Product/ProductGroup, or og:type=product) from the sitemap sample; take up to 20. Per page assert: (1) identity — sku or productID or mpn present, non-empty, <=100 chars, and stable across two fetches; gtin/gtin13/gtin14 present as 8-14 digits with no dashes or spaces if claimed. (2) brand.name present, <=70 chars. (3) description present, <=5000 chars, and contains no HTML tags after unescaping (OpenAI requires plain text). (4) image absolute HTTPS, extension/Content-Type in {image/jpeg,image/png} — HEAD it; flag WebP/AVIF-only as an OpenAI-spec risk. (5) offers.price parses as a positive decimal and offers.priceCurrency is a valid ISO 4217 code (validate against a bundled list, not a regex). (6) offers.availability is the full https://schema.org/InStock-style URL, not a bare token like 'InStock' or 'in stock' — the single most common defect; map to the OpenAI enum {in_stock,out_of_stock,pre_order,backorder} and FAIL on unmappable values. (7) offers.itemCondition is one of the three schema.org condition URLs. (8) offers.seller.name present (maps to seller_name). (9) a country signal exists: offers.eligibleRegion, areaServed, availableAtOrFrom.address.addressCountry, or shippingDetails.shippingDestination.addressCountry, resolvable to ISO 3166-1 alpha-2. (10) variants: if the page exposes sibling variants, isVariantOf/inProductGroupWithID must be present and stable (maps to item_group_id, required for BR/FR/DE/JP/UK/US). (11) sale price sanity: when both price and a strikethrough/list price exist in markup, assert sale <= list. (12) PRICE PARITY — extract currency-formatted numerals from the raw HTML near the offer container and assert the JSON-LD price appears among them; FAIL on mismatch and report both values. (13) offers.url, when present, must equal rel=canonical. Score = per-field pass rate across the sample, with the OpenAI-only fields (brand, seller, target country, plain-text description, JPEG/PNG image) reported as a distinct 'agent-commerce gap' sub-score so users can see what Google-oriented tooling missed.

## Example failure

A Shopify store's Product JSON-LD emits `"availability": "InStock"` (bare token, not the schema.org URL), omits `itemCondition` and `offers.seller`, and renders the sale price in the DOM via a currency-conversion script so the JSON-LD says 49.00 USD while the visible price is 42.00 USD. Google's Rich Results Test passes. Automatic item updates cannot parse availability or condition, falls back to ML extractors, and item-level disapprovals begin; separately the OpenAI feed is rejected on brand/seller_name and an agent reading the page quotes 49.00 to a shopper who is charged 42.00 — or the reverse.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Relationship to `agentic-commerce/checkout-offer-field-mapping`

The overlap is deliberate. The two audits look at the same spec from opposite
ends and must not be merged:

| Audit | Scope | Question |
| --- | --- | --- |
| `agentic-commerce/checkout-offer-field-mapping` | One scanned product page | Does this offer graph map onto a feed row that passes validation? |
| `machine-discovery/agent-commerce-feed-parity` | Product pages sampled from the sitemap | Does the *catalogue* carry the fields, and how many pages fall short? |

Only this audit reports the per-field pass rate across a sample and the
separate **agent-commerce gap** — the fields OpenAI's feed requires that
Google's rich-result validator never asks for (brand, seller, target country,
plain-text description, JPEG/PNG image). Only the other one checks the
conditional feed triggers (`availability_date`, `identifier_exists`,
checkout-eligibility policy links) in depth. A site can pass one and fail the
other, which is the point: one bad template fails here while the scanned PDP
passes there.

## Implementation deviations

- **Deterministic sample, not a reservoir sample.** `sampleEntries` (even
  stride) picks the 6 sitemap URLs, so a re-scan opens the same pages and two
  runs can be compared.
- **Sample size is 6 pages, not the sketch's 20.** The sitemap walk and the
  sampled documents are shared with the other two sitemap-sampling audits
  (`siteSitemapTree` and `fetchSampledPage`), and a scan of a live docs site
  showed the three audits together adding about six seconds of network time;
  six pages keeps the signal and the budget.
- **Identity stability is not re-fetched.** The sketch asks that `sku` be
  "stable across two fetches". A second GET of every sampled page doubles the
  request budget to detect a defect no observed CMS produces; the audit checks
  presence, the character cap and the GTIN check digit instead, and the
  stability probe is listed under Deferred.
- **`ISO_4217` is a bundled set of active codes**, per the sketch, not a
  `/^[A-Z]{3}$/` regex — the regex accepts `XYZ` and `BTC`.
- **Currency parsing handles both decimal conventions.** `1.234,56` and
  `1,234.56` both resolve to 1234.56, so the price-parity check does not fire on
  a European storefront.
- **Price parity reads the whole rendered body**, with `script`, `style`,
  `template` and `noscript` removed, rather than an "offer container" the audit
  would have to guess at. Removing the scripts is what keeps the JSON-LD's own
  price out of the comparison set.
- **The image media type is read with a HEAD request**, capped at 10 per scan;
  beyond that the extension is the only evidence. A media type outside
  JPEG/PNG is a **risk**, not a defect: the image is valid on the page and only
  the feed is at issue.
- **Sibling variants are detected two ways**: a `hasVariant` array with more
  than one entry, or a `<select>` whose name or id reads as a variant control
  and holds more than one `<option>`.

## Deferred

- **`is_eligible_search` / `is_eligible_checkout` are not inferred.** Both are
  merchant policy, not page evidence, and the checkout-eligibility side is
  covered by the ACP audits in `agentic-commerce`.
- **Sale-versus-list price sanity** lives in
  `agentic-commerce/checkout-offer-field-mapping`, which already reads
  `priceSpecification`; repeating it here would double-count one defect.
- **The country signal is only resolved from alpha-2 shapes.** A page that
  writes "United States" rather than `US` is reported as missing the signal,
  because mapping names to codes needs a name table this audit does not bundle.
- **Sitemap-sampled pages are fetched without the variant selectors a browser
  would render.** A storefront whose variant control is built by client-side
  JavaScript reads here as a single-variant page.
