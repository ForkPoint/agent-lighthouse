---
audit: structured-data/review-schema
category: structured-data
source_file: packages/core/src/audits/structured-data/review-schema.ts
slug: review-schema
evidence_grade: A
disposition: "merged 2026-08-22 (Plan 4, Task 8) — absorbs product-reviews (3.23)"
reviewed: 2026-08-22
sources:
  - google-review-snippet-doc
  - google-search-gallery
  - apple-app-search-web-markup
  - webdatacommons-2024-stats
  - google-ai-features-trust
  - ahrefs-schema-ai-citations
  - google-product-snippet
  - google-merchant-listing
---

# review-schema (`3.13`, `3.23`)

> structured-data · source `review-schema.ts` · merged review/rating audit, absorbs product-reviews (3.23) · evidence grade **A** · tier **scored** (weight 1.0)

## What it checks

One review-markup audit: decide _structurally_ whether the site shows reviews at all, then require the rating data a consumer can actually use — and, on product pages, require it on the Product.

| State                                                                                                                                                                                   | Result                    |
| :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------ |
| no repeated review component, no star-rating widget and no review markup anywhere                                                                                                       | `na`                      |
| a usable rating (`ratingValue` + a non-zero `reviewCount`/`ratingCount`) or a non-empty `review` array — and, where product pages exist, at least one of them carries it on its Product | `pass`                    |
| usable ratings exist, but no product page attaches one to its Product                                                                                                                   | `warn`, priority `medium` |
| review content is shown and no usable rating exists (`"review": []`, `"aggregateRating": {}`, `reviewCount: 0`)                                                                         | `fail`, priority `medium` |

Applicability is ≥3 repeated review/testimonial components, a rendered star-rating widget, microdata review items, or review markup of any quality — never the word "review" in body text.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** Google Search parses `AggregateRating` and `Review` markup on a supported host type, and renders a star review snippet in the search result. That snippet requires `ratingValue`, plus at least one of `ratingCount` or `reviewCount`. Applebot extracts `AggregateRating` for Siri and Spotlight Suggestions.

**Grade: A** — two vendor docs name a consumer and state what it does with the signal, and Google specifies the exact required properties.

**Evidence:**

- Google documents the consumer and the required fields. Review snippets are supported on Book, Course, Event, Local Business, Movie, Product, Recipe and Software App, plus further schema.org types: CreativeWorkSeason, CreativeWorkSeries, Episode, Game, MediaObject, MusicPlaylist, MusicRecording and Organization. `AggregateRating` requires `ratingValue`, and "at least one of `ratingCount` or `reviewCount`" — https://developers.google.com/search/docs/appearance/structured-data/review-snippet (verified 2026-08-21)
- Review snippet remains a live feature in Google's structured data gallery, covering ratings for products, recipes, movies and other content types — https://developers.google.com/search/docs/appearance/structured-data/search-gallery (verified 2026-08-21)
- Apple's web-markup guide lists AggregateRating among the schema.org types Applebot supports for Siri and Spotlight Suggestions — https://developer.apple.com/library/archive/documentation/General/Conceptual/AppSearch/WebContent.html (verified 2026-08-21)
- Adoption: 72.2M AggregateRating entities extracted from the October 2024 Common Crawl — https://webdatacommons.org/structureddata/2024-12/stats/stats.html (verified 2026-08-21)

**Counter-evidence:** The single strongest piece of counter-evidence cuts directly at how this audit is applied. Google: "If the entity that's being reviewed controls the reviews about itself, their pages that use `LocalBusiness` or any other type of `Organization` structured data are ineligible for star review feature." A first-party testimonial block marked up as Review or AggregateRating on a company's own Organization or LocalBusiness page therefore has **no** documented consumer path. The proven mechanism holds for third-party-reviewed host entities such as Product, Recipe and Book, not for self-serving reviews — and self-serving reviews are exactly what the audit's body-text trigger fires on. Google separately disclaims any special schema requirement for AI Overviews and AI Mode — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21) — and a matched difference-in-differences study of 1,885 pages adding JSON-LD found no AI-citation uplift on any platform — https://ahrefs.com/blog/schema-ai-citations/ (verified 2026-08-21)

## Implementation deviations

- This audit absorbed the former `product-reviews` audit. Its record is in
  [merged/structured-data/product-reviews.md](../../merged/structured-data/product-reviews.md).
- The applicability gate is structural: at least 3 repeated review or
  testimonial components, a star-rating widget, microdata review items, or
  review markup of any quality. With none, the result is `notApplicable`.
- A rating counts only with `ratingValue` plus a non-zero `reviewCount` or
  `ratingCount`. A review counts only with `reviewRating`, `reviewBody` or
  `author`. An empty `review` array or an empty `aggregateRating` does not
  count.
- On product pages, ratings that never sit on a Product node warn. A product
  page is one whose Product carries a rating or whose URL matches a product
  path pattern.
- A rating on `Organization` or `LocalBusiness` still passes on non-product
  pages. Google's self-serving-review exclusion is enforced only on product
  pages.
- The audit runs on homepage and product pages.
- Repeated-component detection is class-name based, plus microdata review
  items. A review list with no matching class, microdata or JSON-LD reads as
  `notApplicable`, never as a failure.
