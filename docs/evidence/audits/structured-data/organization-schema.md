---
audit: structured-data/organization-schema
audit_id: "3.3"
category: structured-data
source_file: packages/core/src/audits/structured-data/organization-schema.ts
slug: organization-schema
review_verdict: fix
severity: high
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# organization-schema (`3.3`)

> structured-data · source `organization-schema.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

AI agents use Organization schema to identify your brand, logo, and contact info. Without it, agents cannot confidently attribute content to your organization or display your branding in AI-generated answers. Add this JSON-LD to your homepage <head>.

## Code review findings (2026-08-20, 11-agent pass)

Organization identity is a genuinely valuable signal for AI attribution, but the audit judges `orgSchemas[0]` — the first Organization node in DFS order across every scanned page — which on real sites is usually a nested publisher/seller/provider stub rather than the site's actual Organization block. Sites with complete, correct Organization schema routinely get 'missing: url, logo' warnings.

**Required fix:** Score the BEST Organization (reduce on missing-prop count, as author-schema already does) instead of `orgSchemas[0]`; prefer nodes found on a `pageType === 'homepage'` page and prefer top-level nodes over hoisted nested stubs. Replace the endsWith heuristic with a real schema.org subtype table so `Restaurant`/`Dentist`/`Hotel` resolve to Organization. Accept `image` as a logo fallback.

**False-positive risks:**
- `const org = orgSchemas[0]` after `allSchemas(ctx)` flattens every nested node. An Article's `"publisher": {"@type":"Organization","name":"Acme"}`, an Offer's `"seller"`, a Service's `"provider"`, or a Person's `"affiliation"` are all hoisted to top level and frequently precede the real Organization node in `@graph` order. Result: 'Organization schema found but missing: url, logo' on a site whose standalone Organization block has all three. High-frequency false warn on WordPress, Shopify and any hand-rolled @graph.
- Declared `applicablePageTypes: ['homepage']` but `allSchemas(ctx)` reads every scanned page, so an Organization stub on a blog post can outrank the homepage's complete block.
- `hasProps` is a plain falsy check, so `"logo": {"@id": "#/schema/logo"}` passes but a site that supplies its logo via `"image"` (accepted by Google as a logo fallback for Organization) is warned for a missing logo.
- `matchesOrgType` does string suffix matching (`t.endsWith('Store')`, `t.endsWith('Business')`), so `LocalBusiness`, `Restaurant`... — actually only names literally ending in those words match; genuine LocalBusiness subtypes like `Restaurant`, `Dentist`, `HotelDeltaHotel` are NOT matched, so a restaurant site with correct `@type: "Restaurant"` schema is reported as having no Organization schema at all. False fail at high priority.
- Only one Organization is ever evaluated, so a site with two (e.g. a parent brand and a sub-brand) is scored on whichever the flattener emits first.

**Test gaps:**
- No test where a nested publisher/seller Organization precedes the real one — the primary false-warn path
- No test for a LocalBusiness subtype (`Restaurant`, `Dentist`) which the type matcher silently misses
- No test with more than one Organization node on a page
- No test scoping to homepage vs. inner pages despite `applicablePageTypes: ['homepage']`
- No test for `logo` supplied as an ImageObject or via `image`

**Overlaps with:** `3.12`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Graded evidence (2026-08-21)

**Mechanism claim:** Google Search parses Organization markup on a site's home page and uses its `logo`, `name` and `url` to choose the logo and organization details rendered in Search results and in the knowledge panel; Applebot extracts Organization markup for Siri and Spotlight Suggestions.

**Grade: A** — two vendor docs name a consumer and state what it does with the signal, and adoption is at web scale.

**Evidence:**
- Google: "Adding organization structured data to your home page can help Google better understand your organization's administrative details and disambiguate your organization in search results"; the properties determine "which `logo` is shown in Search results" and "can influence visual elements in Search results... your knowledge panel", plus merchant knowledge panel and brand profile details — https://developers.google.com/search/docs/appearance/structured-data/organization (verified 2026-08-21)
- Organization is still a live feature in Google's structured data gallery: "Information about your organization, such as your logo, legal name of the organization, address." — https://developers.google.com/search/docs/appearance/structured-data/search-gallery (verified 2026-08-21)
- Apple's web-markup guide lists Organization among the schema.org types Applebot supports for Siri and Spotlight Suggestions (alongside AggregateRating, Offers, PriceRange, InteractionCount, Recipe, SearchAction, ImageObject) — https://developer.apple.com/library/archive/documentation/General/Conceptual/AppSearch/WebContent.html (verified 2026-08-21)
- Adoption: Organization JSON-LD found on 6.6M domains in the October 2024 Common Crawl, and on 7.16% of mobile pages — https://webdatacommons.org/structureddata/2024-12/stats/stats.html and https://almanac.httparchive.org/en/2024/structured-data (both verified 2026-08-21)

**Counter-evidence:** Google states plainly that for Organization "There are no required properties; instead, we recommend adding as many properties that are relevant to your organization" — `name`, `url` and `logo` are recommendations, not a contract, so warning a site for a missing one overstates the documented consequence. Google's AI guidance disclaims the AI-agent framing in the audit's own description: "You don't need to create new machine readable files, AI text files, or markup to appear in these features. There's also no special schema.org structured data that you need to add" — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21). A matched difference-in-differences study of 1,885 pages that added JSON-LD against ~4,000 controls found no citation uplift on any AI platform (AI Mode +2.4%, ChatGPT +2.2% — both indistinguishable from noise; AI Overviews −4.6%) — https://ahrefs.com/blog/schema-ai-citations/ (verified 2026-08-21)
