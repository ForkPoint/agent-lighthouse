---
audit: generative-engine/review-signals
audit_id: "10.8"
category: generative-engine
source_file: packages/core/src/audits/generative-engine/review-signals.ts
slug: review-signals
review_verdict: fix
severity: high
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# review-signals (`10.8`)

> generative-engine · source `review-signals.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

AI engines use reviews and testimonials as social proof signals when recommending products or services in generated answers.

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

**Overlaps with:** `10.14`, `10.7`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
