---
audit: answer-readiness/review-signals
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/review-signals.ts
slug: review-signals
evidence_grade: B
disposition: "merged 2026-08-22 (Plan 4, Task 6) — absorbs blockquote-usage (10.14)"
reviewed: 2026-08-24
sources:
  - google-review-snippet-doc
  - openai-feed-spec-confirm
  - schema-aggregaterating
  - google-ai-features-trust
---

# review-signals (`10.8`, `10.14`)

> answer-readiness · source `review-signals.ts` · merged social-proof audit, absorbs blockquote-usage (10.14) · evidence grade **B** · tier **scored** (weight 0.6)

## What it checks

Social proof an agent can actually read.

| State                                                                                                                                                                                         | Result                    |
| :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------ |
| JSON-LD `Review`/`AggregateRating` carrying a rating value or a non-zero `reviewCount`/`ratingCount`, on a homepage or product page; or a `<blockquote>` with attribution on any scanned page | `pass`                    |
| review UI with nothing machine-readable behind it — client-injected widget markup, or visible "N reviews" text — on a homepage or product page                                                | `warn`, priority `medium` |
| none of the above                                                                                                                                                                             | `fail`, priority `medium` |

Attribution means a `cite` attribute naming a document, or a non-empty `<cite>`, `<footer>`, or `<figcaption>` in a wrapping `<figure>`.

The review vocabulary is read only from homepage and product pages: that is the population Google's review rich results and OpenAI's `review_count`/`star_rating` cover. The quotation branch is not scoped that way, because its GEO measurement is about generative-answer citation on content generally.

An empty `<blockquote>` is ignored. A node stating `reviewCount`/`ratingCount` of `0` is not social proof, and neither is the vocabulary without a value behind it — `"aggregateRating": {}`, `"aggregateRating": true` and a bare `{"@type":"Review"}` all count for nothing. An unattributed pull-quote is reported but sets no status.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** Machine-readable review data is read by named consumers. Google Search parses schema.org `Review` and `AggregateRating` to render review rich results, and OpenAI ingests `review_count` and `star_rating` to build ChatGPT product results. A product page that exposes ratings only as pixels is therefore invisible to both, while one that exposes them structurally is not.

**Grade: B** — consumption of the review vocabulary is documented on both a search surface and an AI surface. But the ChatGPT path runs through a submitted product feed, not the on-page markup this audit inspects. And no study measures a citation delta for review markup.

**Evidence:**

- Google documents parsing the markup and the feature it drives: "When Google finds valid reviews or ratings markup, we may show a rich snippet that includes stars and other summary info from reviews or ratings". The feature is supported on Book, Course, Event, Local business, Movie, Product, Recipe, Software App and further schema.org types — https://developers.google.com/search/docs/appearance/structured-data/review-snippet (verified 2026-08-21)
- OpenAI's commerce specification carries first-class review fields for ChatGPT product results — `review_count` ("Number of product reviews"), `star_rating` ("Average review score"), `store_review_count`, `store_star_rating`, `reviews` — introduced as: "Supply aggregated review statistics and frequently asked questions. User-generated insights strengthen credibility and help shoppers make informed decisions." — https://developers.openai.com/commerce/specs/feed/ (verified 2026-08-21)
- `AggregateRating` is core, ratified schema.org vocabulary: "The average rating based on multiple ratings or reviews". It carries `ratingValue`, `reviewCount` and `ratingCount`, deployed on 1M–10M domains per the Google July 2026 web index sample shown on the type page — https://schema.org/AggregateRating (verified 2026-08-21)

**Counter-evidence:** The OpenAI spec "does not address how OpenAI/ChatGPT obtains product data outside of feed submissions". It says nothing about crawling merchant pages, or about reading on-page schema.org. The ChatGPT consumer path therefore does not directly validate the on-page signal (https://developers.openai.com/commerce/specs/feed/, verified 2026-08-21). Google states that for AI Overviews and AI Mode "There's also no special schema.org structured data that you need to add" (https://developers.google.com/search/docs/appearance/ai-features, verified 2026-08-21). Google also constrains what presence can mean. It prohibits "fake or undisclosed incentivized reviews on your page or in your structured data markup", and requires that "Ratings must be sourced directly from users". The existence of review markup is not itself evidence of social proof (https://developers.google.com/search/docs/appearance/structured-data/review-snippet, verified 2026-08-21). No published measurement links review markup to generative-answer citation rates, and nothing in any source supports counting an unattributed blockquote as a review signal.

## Implementation deviations

- The audit merges the former `blockquote-usage` audit, whose record is in `docs/evidence/merged/answer-readiness/`. Both halves grade B for different mechanisms, so the merged grade stays B.
- Quotation counts are reported, never scored. Only the presence of an attributed quotation passes.
- A rating node needs a rating value or a positive count. A review node needs a body, a named author or a rating.
- A `cite` attribute counts only when it names a document. A value with unescaped whitespace is prose, not a reference.
- The "N reviews" text test strips `script`, `style`, `noscript` and `template` first. A widget element must carry text or children.
- Detection runs per page, and the reported URL is the page the signal was found on.
- The runner fires the audit only on homepage and product pages. The quotation branch is therefore never scored on a content-only scan, although its evidence is not commerce-specific. Widening the scope needs its own decision.
- `findReviewNodes` is exported. `trust-signals` defers its social-proof factor to it.
- `<aside>`, callouts and admonitions are not detected. They belong in a semantic-HTML audit.

## Deferred

- Review-count wording beyond English.
- The widget selector is vendor-specific and case-sensitive.
- No rating-quality gate. A 1.0 rating from two reviews reads the same as 4.8 from 12,000.
