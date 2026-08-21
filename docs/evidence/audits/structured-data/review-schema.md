---
audit: structured-data/review-schema
audit_id: "3.13"
category: structured-data
source_file: packages/core/src/audits/structured-data/review-schema.ts
slug: review-schema
review_verdict: fix
severity: high
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# review-schema (`3.13`)

> structured-data · source `review-schema.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

AI agents use Review/AggregateRating schema as social proof when comparing options. When a user asks "what is the best X?", agents surface structured ratings from schema rather than parsing unstructured testimonial text. Add this schema to make your reviews machine-readable.

## Code review findings (2026-08-20, 11-agent pass)

The applicability trigger tests for the substring 'review' or the word 'stars' anywhere in the page body, which is true on essentially every English commerce page and false on every non-English one — so the gate carries no information in either direction. The detection side then passes on an empty `"review": []` array. Also duplicates 3.23's signal.

**Required fix:** Replace the substring gate with a structural one: require a repeated review-item pattern (≥3 elements matching a review/testimonial component, or a visible star-rating widget) rather than the word 'review' appearing in body text. Require `aggregateRating.ratingValue` AND `reviewCount > 0`, or a non-empty `review` array, before passing. Return `notApplicable` when no review content is detected. Absorb 3.23 (product-reviews) into this audit, scoping the product case by `pageType === 'product'`.

**False-positive risks:**
- `const textPatterns = [/\btestimonial/i, /\breview/i, /\brating/i, /\bstars?\b/i, ...]` tested against `page.$('body').text()`. The bare word 'review' appears on nearly every commerce page — a 'Write a review' link, a 'Reviews' footer nav item, a cookie banner's 'review your preferences', a 'Product reviews' tab label that renders even with zero reviews. The gate is therefore effectively always-true in English, and the audit degenerates into a hard `fail` for any site that has no review programme at all, which is legitimate for B2B, SaaS, and regulated industries.
- Symmetrically, a German ('Bewertungen'), French ('avis'), Spanish ('reseñas'), or Japanese site never matches any pattern, so it lands permanently in the `warn` (0.5) branch — a half-point deduction driven purely by page language.
- `schemasWithReviewProp` accepts `obj['aggregateRating'] || obj['review']` with no emptiness check. `"review": []` is truthy in JS, and Shopify / Judge.me / Yotpo emit exactly that on products with zero reviews — so a store with no reviews at all passes as if it had social proof. False pass on the audit's actual subject.
- No validation that `aggregateRating` contains `ratingValue` and `reviewCount`, despite `expected` claiming both are required. `"aggregateRating": {}` passes.
- `page.$('body').html()` serializes the entire DOM per page purely to run three class-name regexes — on a large SPA that is a multi-megabyte string allocation per page, per scan.
- The precondition-absent branch returns `warn` (0.5) instead of `notApplicable`.

**Test gaps:**
- No test where 'review' appears only as incidental chrome (a 'Write a review' link, a cookie banner) — the always-true gate
- No non-English page test
- No test for `"review": []` or `"aggregateRating": {}` (both currently pass)
- No test asserting `ratingValue`/`reviewCount` are actually present
- No test asserting the no-testimonials branch should be `na` rather than `warn`

**Overlaps with:** `3.23`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Graded evidence (2026-08-21)

**Mechanism claim:** Google Search parses `AggregateRating`/`Review` markup on a supported host type and renders a star review snippet in the search result, for which `ratingValue` plus at least one of `ratingCount` or `reviewCount` is required; Applebot extracts `AggregateRating` for Siri and Spotlight Suggestions.

**Grade: A** — two vendor docs name a consumer and state what it does with the signal, and Google specifies the exact required properties.

**Evidence:**
- Google documents the consumer and the required fields: review snippets are supported on Book, Course, Event, Local Business, Movie, Product, Recipe and Software App, plus further schema.org types (CreativeWorkSeason, CreativeWorkSeries, Episode, Game, MediaObject, MusicPlaylist, MusicRecording, Organization); `AggregateRating` requires `ratingValue` and "at least one of `ratingCount` or `reviewCount`" — https://developers.google.com/search/docs/appearance/structured-data/review-snippet (verified 2026-08-21)
- Review snippet remains a live feature in Google's structured data gallery, covering ratings for products, recipes, movies and other content types — https://developers.google.com/search/docs/appearance/structured-data/search-gallery (verified 2026-08-21)
- Apple's web-markup guide lists AggregateRating among the schema.org types Applebot supports for Siri and Spotlight Suggestions — https://developer.apple.com/library/archive/documentation/General/Conceptual/AppSearch/WebContent.html (verified 2026-08-21)
- Adoption: 72.2M AggregateRating entities extracted from the October 2024 Common Crawl — https://webdatacommons.org/structureddata/2024-12/stats/stats.html (verified 2026-08-21)

**Counter-evidence:** The single strongest piece of counter-evidence cuts directly at how this audit is applied. Google: "If the entity that's being reviewed controls the reviews about itself, their pages that use `LocalBusiness` or any other type of `Organization` structured data are ineligible for star review feature." A first-party testimonial block marked up as Review/AggregateRating on a company's own Organization or LocalBusiness page therefore has **no** documented consumer path — the proven mechanism holds for third-party-reviewed host entities such as Product, Recipe and Book, not for self-serving reviews, which is exactly the case the audit's body-text trigger fires on. Google separately disclaims any special schema requirement for AI Overviews and AI Mode — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21) — and a matched difference-in-differences study of 1,885 pages adding JSON-LD found no AI-citation uplift on any platform — https://ahrefs.com/blog/schema-ai-citations/ (verified 2026-08-21)
