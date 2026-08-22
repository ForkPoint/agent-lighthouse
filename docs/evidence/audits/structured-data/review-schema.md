---
audit: structured-data/review-schema
audit_id: "3.13, 3.23"
category: structured-data
source_file: packages/core/src/audits/structured-data/review-schema.ts
slug: review-schema
review_verdict: fix
severity: high
evidence_grade: A
disposition: "merged 2026-08-22 (Plan 4, Task 8) — absorbs product-reviews (3.23)"
reviewed: 2026-08-22
---

# review-schema (`3.13`, `3.23`)

> structured-data · source `review-schema.ts` · merged review/rating audit, absorbs product-reviews (3.23) · evidence grade **A** · tier **scored** (weight 1.0)

## What it checks

One review-markup audit: decide *structurally* whether the site shows reviews at all, then require the rating data a consumer can actually use — and, on product pages, require it on the Product.

| State | Result |
| :--- | :--- |
| no repeated review component, no star-rating widget and no review markup anywhere | `na` |
| a usable rating (`ratingValue` + a non-zero `reviewCount`/`ratingCount`) or a non-empty `review` array — and, where product pages exist, at least one of them carries it on its Product | `pass` |
| usable ratings exist, but no product page attaches one to its Product | `warn`, priority `medium` |
| review content is shown and no usable rating exists (`"review": []`, `"aggregateRating": {}`, `reviewCount: 0`) | `fail`, priority `medium` |

Applicability is ≥3 repeated review/testimonial components, a rendered star-rating widget, microdata review items, or review markup of any quality — never the word "review" in body text.

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

**Overlaps with:** `3.23` (now absorbed here)

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-21 — approved: 3.23 merges away into 3.13 (§5).
- 2026-08-22 — merged (Plan 4, Task 8); registry 155 → 154 for this fold.

## Graded evidence (2026-08-21)

**Mechanism claim:** Google Search parses `AggregateRating`/`Review` markup on a supported host type and renders a star review snippet in the search result, for which `ratingValue` plus at least one of `ratingCount` or `reviewCount` is required; Applebot extracts `AggregateRating` for Siri and Spotlight Suggestions.

**Grade: A** — two vendor docs name a consumer and state what it does with the signal, and Google specifies the exact required properties.

**Evidence:**
- Google documents the consumer and the required fields: review snippets are supported on Book, Course, Event, Local Business, Movie, Product, Recipe and Software App, plus further schema.org types (CreativeWorkSeason, CreativeWorkSeries, Episode, Game, MediaObject, MusicPlaylist, MusicRecording, Organization); `AggregateRating` requires `ratingValue` and "at least one of `ratingCount` or `reviewCount`" — https://developers.google.com/search/docs/appearance/structured-data/review-snippet (verified 2026-08-21)
- Review snippet remains a live feature in Google's structured data gallery, covering ratings for products, recipes, movies and other content types — https://developers.google.com/search/docs/appearance/structured-data/search-gallery (verified 2026-08-21)
- Apple's web-markup guide lists AggregateRating among the schema.org types Applebot supports for Siri and Spotlight Suggestions — https://developer.apple.com/library/archive/documentation/General/Conceptual/AppSearch/WebContent.html (verified 2026-08-21)
- Adoption: 72.2M AggregateRating entities extracted from the October 2024 Common Crawl — https://webdatacommons.org/structureddata/2024-12/stats/stats.html (verified 2026-08-21)

**Counter-evidence:** The single strongest piece of counter-evidence cuts directly at how this audit is applied. Google: "If the entity that's being reviewed controls the reviews about itself, their pages that use `LocalBusiness` or any other type of `Organization` structured data are ineligible for star review feature." A first-party testimonial block marked up as Review/AggregateRating on a company's own Organization or LocalBusiness page therefore has **no** documented consumer path — the proven mechanism holds for third-party-reviewed host entities such as Product, Recipe and Book, not for self-serving reviews, which is exactly the case the audit's body-text trigger fires on. Google separately disclaims any special schema requirement for AI Overviews and AI Mode — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21) — and a matched difference-in-differences study of 1,885 pages adding JSON-LD found no AI-citation uplift on any platform — https://ahrefs.com/blog/schema-ai-citations/ (verified 2026-08-21)

## The merge (Plan 4, Task 8, 2026-08-22)

3.13 and 3.23 measured the same property with two different gates, so the same markup could pass one and fail the other — 3.23's dossier calls that out as "a visibly contradictory report". 3.23's required fix names the destination precisely: *"Merge into 3.13 … Keep a single audit that: gates on a structural review-content signal, scopes the product case to `pageType === 'product'` and to Product-attached ratings, requires `ratingValue` plus `reviewCount > 0` (or a non-empty `review` array), and returns `notApplicable` for sites with no reviewable entities."* All four clauses land here.

**The applicability gate is structural.** The old trigger tested `page.$('body').text()` for `/\breview/i`, `/\brating/i` or `/\bstars?\b/i` — true on essentially every English commerce page (a "Write a review" link, a cookie banner's "review your preferences", a "Reviews" footer item) and false on every German, French, Spanish or Japanese one. It is replaced by ≥3 repeated review/testimonial components, a rendered star-rating widget, microdata review items, or the presence of review markup of any quality. Where nothing at all is found the audit now returns `na` instead of the vacuous `warn` (0.5) that punished sites with no review programme.

**Detection requires substance.** `obj['aggregateRating'] || obj['review']` accepted `"review": []` — the exact shape Shopify, Judge.me and Yotpo emit on a product with zero reviews — and `"aggregateRating": {}`, which 3.23 accepted too via `typeof … === 'object'`. Both now fail. A rating counts only with `ratingValue` plus a non-zero `reviewCount` or `ratingCount`, which is Google's stated requirement, and a review counts only when it carries `reviewRating`, `reviewBody` or `author`.

**The DOM is no longer serialised.** The old class-name check ran three regexes over `page.$('body').html()` — a full re-serialisation of the document per page, per scan, purely to read class attributes. The merged audit reads `class` off `[class]` elements directly.

### Absorbed evidence — product-reviews (3.23)

3.23's dossier is kept verbatim at [merged/structured-data/product-reviews.md](../../merged/structured-data/product-reviews.md) (grade **A**). Its evidence is the product half of the same Google review-snippet mechanism 3.13 grades on — `ratingValue` required, "at least one of `ratingCount` or `reviewCount` is required", `Product` among the supported host types — reinforced by [Product snippet](https://developers.google.com/search/docs/appearance/structured-data/product-snippet) and [merchant listing](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing) markup and by OpenAI's product feed carrying `star_rating` and `review_count` per item.

Its grading closes with the sentence that shapes the merged implementation: *"The grade applies to a Product-attached rating with a non-empty count, not to the presence of any `aggregateRating` object anywhere on the site."* So the product case is scoped: when the scan contains `pageType === 'product'` pages and none of them carries a rating on its own Product node, the result is a `warn` that says so, instead of the false `pass` a single homepage "4.8 on Trustpilot" badge used to buy for a 500-SKU catalogue. That also answers the shared counter-evidence — Google excludes self-controlled `Organization`/`LocalBusiness` reviews from the star treatment, and a site-wide badge is exactly that.

### Grade decision: stays **A**, tier `scored`, weight 1.0

Both audits grade **A** on the same proven consumer path (Google parses `ratingValue` + `ratingCount`/`reviewCount` and renders a review snippet; Applebot extracts `AggregateRating` for Siri and Spotlight). The absorbed evidence is not *stronger*, it is the same mechanism seen from the Product side, so the grade does not move: **A**, `tier: scored`, `weightForGrade('A', 'scored')` = **1.0**. What the merge changes is accuracy, not price — the A-grade mechanism is now actually the thing being measured (rating value plus non-zero count, on the host entity Google supports), where before a truthy empty array satisfied it.

### Deviations

- **A rating on `Organization`/`LocalBusiness` still passes on non-product pages.** Google's self-serving-review exclusion is real, but demoting every first-party testimonial block to a failure would punish sites that publish their reviews correctly for other consumers; the product-page scoping is where the exclusion actually bites, and that is where it is enforced.
- **`applicablePageTypes` stays `['homepage', 'product']`** rather than gaining `content`. The audit itself reads every crawled page (the product scoping needs them), so the field only steers page-type reporting.
- **Repeated-component detection is class-name based** (`testimonial`, `review-item`/`review-card`/`review-body`, `customer-review`, plus microdata `[itemtype*="Review"]`/`[itemprop="review"]`). A review list rendered with entirely semantic class names and no microdata or JSON-LD is invisible to it — which yields `na`, never a false failure.
