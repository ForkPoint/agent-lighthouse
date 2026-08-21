---
audit: structured-data/review-schema
audit_id: "3.13"
category: structured-data
source_file: packages/core/src/audits/structured-data/review-schema.ts
slug: review-schema
review_verdict: fix
severity: high
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# review-schema (`3.13`)

> structured-data · source `review-schema.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

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
