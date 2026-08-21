---
audit: structured-data/product-reviews
audit_id: "3.23"
category: structured-data
source_file: packages/core/src/audits/structured-data/product-reviews.ts
slug: product-reviews
review_verdict: merge
severity: medium
evidence_grade: unrated
disposition: "merge (approved 2026-08-21)"
reviewed: 2026-08-21
---

# product-reviews (`3.23`)

> structured-data · source `product-reviews.ts` · review verdict **merge** · evidence grade **unrated** · disposition: **merge (approved 2026-08-21)**

## What it checks

AI agents often rank products based on user ratings and review volume. Providing AggregateRating schema allows agents to confidently recommend highly-rated items to users.

## Code review findings (2026-08-20, 11-agent pass)

Measures exactly the same underlying signal as 3.13's `schemasWithReviewProp` detection (`obj['aggregateRating'] || obj['review']`), but with a different gate, so the two audits can disagree on identical markup. On its own it is not scoped to product pages despite claiming to be, and it passes on empty/zero-count rating objects.

**Required fix:** Merge into 3.13 (Review/AggregateRating schema). Keep a single audit that: gates on a structural review-content signal, scopes the product case to `pageType === 'product'` and to Product-attached ratings, requires `ratingValue` plus `reviewCount > 0` (or a non-empty `review` array), and returns `notApplicable` for sites with no reviewable entities. Delete this file and its registration once merged.

**False-positive risks:**
- `schemas.filter(...)` runs over EVERY node on every scanned page with no product scoping, despite `applicablePageTypes: ['product']` and a title of 'Product reviews and ratings'. A single homepage `aggregateRating` (a '4.8 on Trustpilot' badge, or an Organization-level rating) makes the audit pass for a 500-SKU catalogue where no PDP has any ratings. False pass on the audit's stated subject.
- `rec['aggregateRating'] && typeof rec['aggregateRating'] === 'object'` performs no content validation — `"aggregateRating": {}` or `{"ratingValue": null, "reviewCount": 0}` passes, while the `expected` string promises 'AggregateRating schema with ratingValue and reviewCount'. A product with zero reviews is reported as having social proof.
- It duplicates 3.13's detection with a DIFFERENT applicability gate (3.13 requires testimonial-like text on the page; 3.23 requires nothing), so the same site can simultaneously get a pass from 3.23 and a fail from 3.13 on identical markup — a visibly contradictory report.
- `weight: 0.8` is dead: `calculateCategoryScore` (scorer.ts:8) takes an unweighted mean and never reads `meta.weight`, so the intended de-emphasis does not happen.
- No `notApplicable` for non-commerce sites; a content site with no products at all gets a `warn` telling it to add product ratings.

**Test gaps:**
- No test where the only aggregateRating is on the homepage/Organization rather than on a Product (the false pass)
- No test for `"aggregateRating": {}` or `reviewCount: 0`
- No test asserting agreement with 3.13 on the same markup
- No test for a non-commerce site (should be `na`, currently warns)

**Overlaps with:** `3.13`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
