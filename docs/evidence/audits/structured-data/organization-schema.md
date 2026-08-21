---
audit: structured-data/organization-schema
audit_id: "3.3"
category: structured-data
source_file: packages/core/src/audits/structured-data/organization-schema.ts
slug: organization-schema
review_verdict: fix
severity: high
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# organization-schema (`3.3`)

> structured-data · source `organization-schema.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

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
