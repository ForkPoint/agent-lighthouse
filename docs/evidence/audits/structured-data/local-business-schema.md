---
audit: structured-data/local-business-schema
audit_id: "3.12"
category: structured-data
source_file: packages/core/src/audits/structured-data/local-business-schema.ts
slug: local-business-schema
review_verdict: fix
severity: medium
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# local-business-schema (`3.12`)

> structured-data · source `local-business-schema.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

AI agents use LocalBusiness schema to answer location-based queries like "find a [service] near me." Without it, your business is invisible to location-aware AI systems. Add address, telephone, and openingHours to help agents provide accurate local recommendations.

## Code review findings (2026-08-20, 11-agent pass)

The intent — only demand LocalBusiness schema from sites that actually have a storefront — is right, and the AND-gate is a real improvement over the previous zip-code heuristic. But both halves of the gate are English-only and loosely matched, so it fires on online-only EU stores (whose footer address is legally mandatory) and stays silent on genuine non-English retail chains.

**Required fix:** Tighten the storefront gate: require either ≥2 distinct PostalAddress blocks, or a locator page that itself lists multiple addresses, before demanding LocalBusiness — a single company address plus a `/store` link is not a storefront. Exclude bare `/store`/`/shop` from the href pattern (keep `store-locator`, `find-a-store`, `/locations`). Replace English text matching with a locator-page fetch, or drop text matching entirely. Expand the accepted type list to LocalBusiness subtypes via a schema.org subtype table.

**False-positive risks:**
- `/\/stores?(\/|$|\?)/` matches the href `/store` — the single link labelled 'Store' or 'Shop' in the nav of virtually every Shopify/Squarespace site with no physical location. Paired with `hasPostalAddressBlock`, which is satisfied by an Organization's nested `address` (a legally mandatory Impressum/company address across the EU), this produces a hard `fail` telling online-only DTC brands to add LocalBusiness schema for storefronts they do not have.
- The link-text patterns are English-only: `store locator|find a store|store finder|our locations|find a location|where to buy`. German 'Filialsuche', French 'Nos magasins', Spanish 'Tiendas', Japanese '店舗検索' never match, so a real multi-location non-English retail chain always returns `na` — the audit's core purpose silently fails for every non-English market.
- The AND-gate requires both signals on the SAME page. Real chains put the locator link in the global header but the PostalAddress only on /contact, or vice versa; the co-occurrence never happens on the sampled pages and the audit returns `na` on exactly the businesses it exists to check (false negative).
- `allSchemas(ctx)` means a LocalBusiness node found on ANY page satisfies the check for all pages, so a chain that marks up one location and omits the other 200 passes.
- `matchesAnyType(s, ['LocalBusiness','ProfessionalService'])` misses the LocalBusiness subtypes that correct markup actually uses — `Restaurant`, `Dentist`, `AutoRepair`, `HealthAndBeautyBusiness` — so a properly-typed restaurant with a storefront hard-fails 'no LocalBusiness schema found'.

**Test gaps:**
- No test for an online-only store whose nav has a `/store` link plus an EU Impressum footer address (the primary false fail)
- No non-English locator-link test
- No test where the address and the locator link live on different pages
- No test for LocalBusiness subtypes (`Restaurant`, `Dentist`)
- No test for a multi-location chain where only one location is marked up

**Overlaps with:** `3.3`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Graded evidence (2026-08-21)

**Mechanism claim:** Google Search and Google Maps parse LocalBusiness markup — for which `name` and a `PostalAddress` are the required properties — and may use it to populate the business knowledge panel and business carousels for local queries.

**Grade: A** — a vendor doc names two consumers (Google Search, Google Maps), states the behavior, and specifies the required properties; the type is a live search feature with multi-million-domain adoption.

**Evidence:**
- Google: "When users search for businesses on Google Search or Maps, Search results may display a prominent Google knowledge panel with details about a business that matched the query." The doc also covers business carousels for business-type searches and reservation/ordering via the Maps Booking API. Required properties are `name` and `address` (a `PostalAddress`) — https://developers.google.com/search/docs/appearance/structured-data/local-business (verified 2026-08-21)
- Local business remains a live feature in Google's structured data gallery: "Business details displayed in the Google knowledge panel, including open hours, ratings, directions." — https://developers.google.com/search/docs/appearance/structured-data/search-gallery (verified 2026-08-21)
- Adoption: LocalBusiness found on 1.3M domains in the October 2024 Common Crawl, and on 3.97% of mobile pages — https://webdatacommons.org/structureddata/2024-12/stats/stats.html and https://almanac.httparchive.org/en/2024/structured-data (both verified 2026-08-21)

**Counter-evidence:** Google guarantees nothing: "Google does not guarantee that features that consume structured data will show up in search results." The audit's claim that without this markup a business is "invisible to location-aware AI systems" has no documented consumer behind it — no LLM or assistant vendor names LocalBusiness, and Apple's Applebot supported-type list does not include it (it lists AggregateRating, Offers, PriceRange, InteractionCount, Organization, Recipe, SearchAction, ImageObject) — https://developer.apple.com/library/archive/documentation/General/Conceptual/AppSearch/WebContent.html (verified 2026-08-21). Google also disclaims any special schema requirement for AI Overviews and AI Mode — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21). Finally, Google's required set is `name` + `address` only; `telephone` and `openingHours` are recommended, so demanding them as the audit's guidance does overstates the documented contract.
