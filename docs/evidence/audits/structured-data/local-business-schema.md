---
audit: structured-data/local-business-schema
category: structured-data
source_file: packages/core/src/audits/structured-data/local-business-schema.ts
slug: local-business-schema
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - google-localbusiness-doc
  - google-search-gallery
  - webdatacommons-2024-stats
  - webalmanac-2024-structured-data
  - apple-app-search-web-markup
  - google-ai-features-trust
---

# local-business-schema (`3.12`)

> structured-data · source `local-business-schema.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

AI agents use LocalBusiness schema to answer location-based queries like "find a [service] near me." Without it, your business is invisible to location-aware AI systems. Add address, telephone, and openingHours to help agents provide accurate local recommendations.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** Google Search and Google Maps parse LocalBusiness markup — for which `name` and a `PostalAddress` are the required properties — and may use it to populate the business knowledge panel and business carousels for local queries.

**Grade: A** — a vendor doc names two consumers (Google Search, Google Maps), states the behavior, and specifies the required properties; the type is a live search feature with multi-million-domain adoption.

**Evidence:**

- Google: "When users search for businesses on Google Search or Maps, Search results may display a prominent Google knowledge panel with details about a business that matched the query." The doc also covers business carousels for business-type searches and reservation/ordering via the Maps Booking API. Required properties are `name` and `address` (a `PostalAddress`) — https://developers.google.com/search/docs/appearance/structured-data/local-business (verified 2026-08-21)
- Local business remains a live feature in Google's structured data gallery: "Business details displayed in the Google knowledge panel, including open hours, ratings, directions." — https://developers.google.com/search/docs/appearance/structured-data/search-gallery (verified 2026-08-21)
- Adoption: LocalBusiness found on 1.3M domains in the October 2024 Common Crawl, and on 3.97% of mobile pages — https://webdatacommons.org/structureddata/2024-12/stats/stats.html and https://almanac.httparchive.org/en/2024/structured-data (both verified 2026-08-21)

**Counter-evidence:** Google guarantees nothing: "Google does not guarantee that features that consume structured data will show up in search results." The audit's claim that without this markup a business is "invisible to location-aware AI systems" has no documented consumer behind it. No LLM or assistant vendor names LocalBusiness, and Apple's Applebot supported-type list does not include it — that list is AggregateRating, Offers, PriceRange, InteractionCount, Organization, Recipe, SearchAction and ImageObject — https://developer.apple.com/library/archive/documentation/General/Conceptual/AppSearch/WebContent.html (verified 2026-08-21). Google also disclaims any special schema requirement for AI Overviews and AI Mode — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21). Finally, Google's required set is `name` + `address` only; `telephone` and `openingHours` are recommended, so demanding them as the audit's guidance does overstates the documented contract.
