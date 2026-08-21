---
audit: structured-data/local-business-schema
audit_id: "3.12"
category: structured-data
source_file: packages/core/src/audits/structured-data/local-business-schema.ts
slug: local-business-schema
review_verdict: fix
severity: medium
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# local-business-schema (`3.12`)

> structured-data · source `local-business-schema.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

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
