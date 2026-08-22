---
audit: answer-readiness/review-signals
audit_id: "10.8, 10.14"
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/review-signals.ts
slug: review-signals
review_verdict: fix
severity: high
evidence_grade: B
disposition: "merged 2026-08-22 (Plan 4, Task 6) — absorbs blockquote-usage (10.14)"
reviewed: 2026-08-22
---

# review-signals (`10.8`, `10.14`)

> answer-readiness · source `review-signals.ts` · merged social-proof audit, absorbs blockquote-usage (10.14) · evidence grade **B** · tier **scored** (weight 0.6)

## What it checks

Social proof an agent can actually read, across the scanned pages.

| State | Result |
| :--- | :--- |
| JSON-LD `Review`/`AggregateRating` (or a non-zero `reviewCount`/`ratingCount`), or a `<blockquote>` with attribution — `cite` attribute, `<cite>`, `<footer>`, or a `<figcaption>` in a wrapping `<figure>` | `pass` |
| review UI with nothing machine-readable behind it — client-injected widget markup, visible "N reviews" text, or quotations with no attribution | `warn`, priority `medium` |
| none of the above | `fail`, priority `medium` |

An empty `<blockquote>` is ignored, and a node stating `reviewCount`/`ratingCount` of `0` is not social proof.

## Code review findings (2026-08-20, 11-agent pass)

Genuinely valuable signal: Review/AggregateRating in structured data is consumed today by AI shopping and recommendation surfaces, and the deep `flattenJsonLd` walk plus the third-party-widget fallback show real awareness of how Shopify stores work. But the pass condition is `signals.length > 0` and an UNATTRIBUTED blockquote is pushed into `signals` — so any page with a decorative pull-quote passes a 'Review/testimonial signals' audit, directly contradicting the audit's own expected-value string ('blockquote elements with attribution'). The test suite codifies this contradiction as correct.

**Required fix:** 1) Require attribution: only attributed blockquotes enter `signals`; unattributed ones are no signal, or at most a `warn`. 2) Make structured Review/AggregateRating the pass condition and treat DOM/widget/text fallbacks as `warn` ('review UI detected but not machine-readable') — that distinction is the whole point for an agent consumer. 3) Reject `reviewCount`/`ratingCount` values that parse to 0. 4) Strip `script,style,noscript,template` before the `\d+ reviews` text test, matching what 10.6/10.7 already do. 5) Evaluate the widget/text fallback per page instead of gating on the global `signals.length === 0`. 6) Scope to `pageType` in ('homepage','product') and report the real source page. 7) Add non-English review-count patterns keyed off `lang`.

**False-positive risks:**
- `signals.push(`${blockquotes.length} blockquote(s) (no attribution)`)` in the else branch makes an unattributed blockquote a review signal. Any editorial pull-quote, or a legal page quoting a statute, PASSES. The test 'passes via blockquote without attribution' asserts this as intended.
- `/\b\d[\d,]*\s+reviews?\b/i.test($('body').text())` matches text anywhere including a footer link, and — critically — inside `<script>`/`<style>`, because this call uses raw `$('body').text()` without the clone-and-strip that sibling audits 10.6 and 10.7 both perform. An inline JSON payload containing `"1234 reviews"` passes.
- That regex is English-only: 'Bewertungen', 'avis', 'reseñas', 'レビュー' never match, so a non-English store with thousands of visible reviews falls through to FAIL.
- Widget selectors `[class*="yotpo"],[class*="okendo"],[class*="jdgm"],…,[class*="star-rating"]` are case-sensitive and vendor-specific: `class="Yotpo"`, a self-built rating component, or Tailwind-only star markup miss entirely → false FAIL on a store with visible ratings. Conversely `[class*="star-rating"]` matches an empty placeholder div that never populates → false PASS.
- `findReviewNodes` pushes on `record['review']`/`record['reviewCount']`/`record['ratingCount']` regardless of value. `"reviewCount": "0"` is a truthy string and pushes 'reviewCount', so a product with zero reviews PASSES as having social proof — and whether it does depends on whether the CMS serialized the count as a string or the falsy number `0`.
- No rating-quality gate: `"aggregateRating":{"ratingValue":"1.0","reviewCount":"2"}` reads identically to 4.8/12,000.
- `applicablePageTypes: ['homepage','product']` doesn't filter the loop, so a blog post's pull-quote satisfies a product-page review audit and `pageUrl` reports `ctx.pages[0]`.
- `signals` accumulates across all pages before the single `signals.length > 0` test, while the widget/N-reviews fallback is guarded by `if (signals.length === 0)` — already non-zero from page one. The fallback therefore silently stops running after the first productive page, making per-page detection order-dependent.

**Test gaps:**
- No test asserting that an unattributed decorative blockquote should NOT count — the current test asserts the opposite.
- No test for `reviewCount: "0"` / zero-review products.
- No test for a non-English review count string.
- No test for `"1234 reviews"` inside an inline `<script>` payload.
- No test for a self-built or Tailwind star-rating component with no vendor class.
- No test for an empty widget placeholder div.
- No test where the blockquote is on a content page while the audit is nominally product/homepage-scoped.
- No test for the `signals.length === 0` guard suppressing the fallback on later pages.

**Overlaps with:** `10.14` (now absorbed here), `10.7`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Graded evidence (2026-08-21)

**Mechanism claim:** Machine-readable review data is read by named consumers — Google Search parses schema.org `Review`/`AggregateRating` to render review rich results, and OpenAI ingests `review_count`/`star_rating` to build ChatGPT product results — so a product page that exposes ratings only as pixels is invisible to both, while one that exposes them structurally is not.

**Grade: B** — consumption of the review vocabulary is documented on both a search surface and an AI surface, but the ChatGPT path runs through a submitted product feed rather than the on-page markup this audit inspects, and no study measures a citation delta for review markup.

**Evidence:**
- Google documents parsing the markup and the feature it drives: "When Google finds valid reviews or ratings markup, we may show a rich snippet that includes stars and other summary info from reviews or ratings", supported on Book, Course, Event, Local business, Movie, Product, Recipe, Software App and further schema.org types — https://developers.google.com/search/docs/appearance/structured-data/review-snippet (verified 2026-08-21)
- OpenAI's commerce specification carries first-class review fields for ChatGPT product results — `review_count` ("Number of product reviews"), `star_rating` ("Average review score"), `store_review_count`, `store_star_rating`, `reviews` — introduced as: "Supply aggregated review statistics and frequently asked questions. User-generated insights strengthen credibility and help shoppers make informed decisions." — https://developers.openai.com/commerce/specs/feed/ (verified 2026-08-21)
- `AggregateRating` is core, ratified schema.org vocabulary ("The average rating based on multiple ratings or reviews") with `ratingValue`, `reviewCount` and `ratingCount`, deployed on 1M–10M domains per the Google July 2026 web index sample shown on the type page — https://schema.org/AggregateRating (verified 2026-08-21)

**Counter-evidence:** The OpenAI spec "does not address how OpenAI/ChatGPT obtains product data outside of feed submissions" — it says nothing about crawling merchant pages or reading on-page schema.org, so the ChatGPT consumer path does not directly validate the on-page signal (https://developers.openai.com/commerce/specs/feed/, verified 2026-08-21). Google states that for AI Overviews and AI Mode "There's also no special schema.org structured data that you need to add" (https://developers.google.com/search/docs/appearance/ai-features, verified 2026-08-21). Google also constrains what presence can mean: it prohibits "fake or undisclosed incentivized reviews on your page or in your structured data markup" and requires that "Ratings must be sourced directly from users", so the existence of review markup is not itself evidence of social proof (https://developers.google.com/search/docs/appearance/structured-data/review-snippet, verified 2026-08-21). No published measurement links review markup to generative-answer citation rates, and nothing in any source supports counting an unattributed blockquote as a review signal.

## The merge (Plan 4, Task 6, 2026-08-22)

10.14's required fix is a single instruction: *"Merge into 10.8 (review-signals), which already inspects blockquotes and already understands `cite`/`<footer>` attribution — and which should stop counting unattributed ones."* Both clauses are executed here, and the second one is also 10.8's own first required fix.

**What v1 did.** 10.14 passed on `p.$('blockquote').length > 0` — any element, anywhere, including an empty one, with no attribution, length or context requirement. 10.8 passed on `signals.length > 0` while pushing unattributed blockquotes into `signals`, so a decorative pull-quote passed an audit whose own expected-value string said "blockquote elements with attribution", and its test suite asserted that contradiction as correct. Between them, one editorial pull-quote satisfied two scored audits about social proof.

**What the merged audit does.** Attribution is the line. An attributed quotation (`cite` attribute, `<cite>`, `<footer>`, or a `<figcaption>` on a wrapping `<figure>`) is a testimonial and passes; an unattributed one is decoration and lands in the warn bucket; an empty one is a spacer and is ignored. That is exactly what 10.14's own graded evidence prescribes — *"Score for the presence of properly attributed quotations (semantic blockquote/cite markup); do not reward quote volume"* — and the audit does not reward volume: the counts are reported, never scored.

Two further required fixes from 10.8 come with the change, because the fold is what makes them coherent:

- **Structured data is the pass condition; DOM detection is a warn** (10.8 fix #2). The widget-class and "N reviews" fallbacks stay — they exist because Shopify review apps inject their schema client-side — but they now report *"Review signals found but not machine-readable"*, which is the distinction that matters for an agent consumer. The unattributed-blockquote state joins them.
- **A stated zero count is not social proof** (10.8 fix #3). `"reviewCount": "0"` is a truthy string, so v1 pushed `reviewCount` and passed a product with no reviews at all — and whether it did depended on whether the CMS serialized the count as a string or the falsy number `0`.

### Absorbed evidence — blockquote-usage (10.14)

10.14's dossier is kept verbatim at [merged/answer-readiness/blockquote-usage.md](../../merged/answer-readiness/blockquote-usage.md) (grade **B**). Its signal — direct quotes from credible, attributed sources — is the strongest *measured* lever in the GEO literature: on GEO-BENCH, Quotation Addition scored 27.2 PAWC vs 19.3 baseline (+40.9%) and led again on live Perplexity.ai (+20.7% PAWC), which is the real source of the widely repeated "up to 40%" headline. That is a measured citation effect, which this audit's own Google/OpenAI evidence does not have.

It is also the evidence that justifies keeping a quotation branch at all after 10.14's implementation is discarded — but its counter-evidence is why the branch is narrow: the study's gains concentrated at ranks 4–5 while rank-1 sources *lost* 22.9%, the quotations used were model-generated rather than real sourced quotes (the winning methods were permitted "completely made-up quotes"), and Subjective Impression was scored by an LLM judge. So the merged audit scores the presence of attributed quotation markup and says nothing about volume, and the guidance no longer repeats 10.14's claim that "AI engines extract `<blockquote>` content as notable citations", which no crawler documentation supports.

### Grade decision: stays **B**, tier `scored`, weight 0.6

Both sources grade **B**, for different mechanisms: 10.8 on documented consumption of the review vocabulary (Google's review rich results; OpenAI's commerce feed carrying `review_count`/`star_rating`), capped because the ChatGPT path runs through a submitted feed rather than on-page markup and no study measures a citation delta; 10.14 on the GEO measurements, capped by the rank-conditional and confounded design above. Neither is a proven path stronger than the other, and combining two B mechanisms does not manufacture an A: **B**, `tier: scored`, `weight 0.6` (`weightForGrade('B', 'scored')`).

`scoreDisplayMode` moves from `binary` to `ternary` for the new middle state. `defaultPriority` stays `medium`.

### Deviations

- **10.8's remaining required fixes stay open**: `<script>`/`<style>` are not stripped before the "N reviews" text test (fix #4), the widget/text detection is English-only and vendor-class-specific (#7 and part of #4), `applicablePageTypes` still does not filter the loop (#6), and there is no rating-quality gate. 10.8 is a `move` row with an open `fix` verdict; this fold does not claim them.
- **One ordering fix did land**: v1 gated the widget/text fallback on the global `signals.length === 0`, so it silently stopped running after the first productive page. Detection is now per page, and the reported `pageUrl` is the page the signal was found on rather than `ctx.pages[0]`.
- **`<aside>`, `<div class="callout">` and admonition markup are still not detected.** 10.14's review notes that its own title promised callouts; that check belongs in a semantic-HTML audit, as the same review says, not in a social-proof one.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-21 — approved: 10.14 folds into 10.8 (§5).
- 2026-08-22 — merged (Plan 4, Task 6); registry 161 → 160 for this fold.
