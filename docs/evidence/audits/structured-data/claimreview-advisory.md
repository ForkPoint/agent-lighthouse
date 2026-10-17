---
audit: structured-data/claimreview-advisory
category: structured-data
source_file: packages/core/src/audits/structured-data/claimreview-advisory.ts
slug: claimreview-advisory
evidence_grade: A
tier: informative
disposition: "new in v2 — graduated from proposal 2026-08-22"
reviewed: 2026-08-20
graduated: 2026-08-22
sources:
  - google-factcheck-doc
---

# ClaimReview investment advisory

> Shipped in v2. Evidence grade **A** · informative tier · partial overlap · implementation: `multi-page`

## What it checks

ADVISORY / UNSCORED. Detects ClaimReview markup and tells the operator the truth about its status rather than rewarding coverage: Google is phasing out ClaimReview support in Search, while the Fact Check Explorer still consumes it. Also validates the required shape and the one-per-page constraint for sites that keep it.

## Claimed mechanism (falsifiable)

Google's fact check documentation states plainly: 'We're phasing out support for ClaimReview markup in Google Search', with no deprecation date, and notes only one ClaimReview element per page qualifies for rich results. A check that scored ClaimReview coverage as an AI-readiness win would therefore push publishers to invest in a channel its largest documented consumer is actively withdrawing from. FALSIFIABLE and grade A on the evidence, but it measures the state of an external product, not the quality of the site — which is exactly why it must not contribute to a score.

## Evidence

- **[Fact Check (ClaimReview) structured data](https://developers.google.com/search/docs/appearance/structured-data/factcheck)** — Google Search Central (vendor-doc, verified 2026-10-17)
  - States: "We're phasing out support for `ClaimReview` markup in Google Search." No phase-out date is given.
  - States that the markup "remains supported by the Factcheck Explorer Tool". That is the advisory's second half.
  - "A page must only have one `ClaimReview` element" to be eligible for the fact check rich result. That is the one-per-page check.
  - Lists `claimReviewed`, `reviewRating` and `url` as required, and `Rating.alternateName` as the human-readable verdict, such as "Mostly true". That is the shape check.

## Example failure

A fact-checking desk plans a quarter of engineering work to extend ClaimReview markup across its archive, expecting AI answer engines to weight the signal. The markup is valid, so every structured-data validator returns green and nothing warns them that Google has announced it is phasing the format out of Search — the roadmap is built on a deprecating surface.

## Scoring

Tier: **informative (weight 0)**. The evidence is grade A, but it describes the state of an external product, not the quality of the site. The audit therefore advises and never scores.

## Implementation deviations

- The audit reads `ctx.pages`, already fetched by the orchestrator. It issues
  no requests of its own.
- Microdata is not parsed. Only JSON-LD is read, including nodes nested in
  `@graph`. Fact-check publishers in the evidence emit JSON-LD.
