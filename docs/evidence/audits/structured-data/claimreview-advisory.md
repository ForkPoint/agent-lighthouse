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
  - S5
---

# ClaimReview investment advisory

> Shipped in v2. Evidence grade **A** · informative tier · partial overlap · implementation: `multi-page`

## What it checks

ADVISORY / UNSCORED. Detects ClaimReview markup and tells the operator the truth about its status rather than rewarding coverage: Google is phasing out ClaimReview support in Search, while the Fact Check Explorer still consumes it. Also validates the required shape and the one-per-page constraint for sites that keep it.

## Claimed mechanism (falsifiable)

Google's fact check documentation states plainly: 'We're phasing out support for ClaimReview markup in Google Search', with no deprecation date, and notes only one ClaimReview element per page qualifies for rich results. A check that scored ClaimReview coverage as an AI-readiness win would therefore push publishers to invest in a channel its largest documented consumer is actively withdrawing from. FALSIFIABLE and grade A on the evidence, but it measures the state of an external product, not the quality of the site — which is exactly why it must not contribute to a score.

## Evidence

- **[MCP Specification 2026-07-28 — Caching](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/caching)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - 'Servers MUST include caching hints on results with resultType: "complete"' for server/discover, tools/list, prompts/list, resources/list, resources/templates/list, resources/read. ttlMs is an integer ms; servers MUST provide ttlMs >= 0. If ttlMs is absent clients SHOULD assume 0 = immediately stale. cacheScope is exactly "public" or "private". Servers MUST apply the same cacheScope to all pages of a paginated list. Public scope on an authenticated endpoint may be shared across access tokens — servers MUST NOT rely on cacheScope for access control.

## Competitor coverage

SEO suites do validate ClaimReview syntax, so the shape validation overlaps. What none of them surface is the deprecation posture or the refusal to score coverage — they still present ClaimReview as an opportunity. Lighthouse's agentic category does not include it at all.

## Implementation sketch

1. Parse JSON-LD (and microdata) for ClaimReview nodes across crawled pages. 2) If none, emit nothing — absence is not a defect. 3) If present, validate required properties: claimReviewed (non-empty), url, and reviewRating carrying a human-readable alternateName such as 'True'/'Mostly false'; flag reviewRating using only numeric ratingValue with no alternateName. 4) Flag pages carrying more than one ClaimReview node, since only one qualifies. 5) Attach the phase-out advisory with the Google doc citation and note that the Fact Check Explorer remains a consumer, so existing markup is not worthless — just not a Search surface. 6) scoreable=false, weight zero: this is a 'know the status before you invest further' signal. Deliberately included as the honest negative answer to whether fact-check schema is an AI-readiness lever — it is not.

## Example failure

A fact-checking desk plans a quarter of engineering work to extend ClaimReview markup across its archive, expecting AI answer engines to weight the signal. The markup is valid, so every structured-data validator returns green and nothing warns them that Google has announced it is phasing the format out of Search — the roadmap is built on a deprecating surface.

## Scoring

Tier per evidence policy: **informative (weight 0)** — grade A does not meet the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

**Category.** The Plan 5 task sheet filed this under `operability-safety`. It
ships under `structured-data`: the audit reads JSON-LD and validates a schema.org
type, which is what that category holds. Filing a schema-shape advisory under
Operability & Safety would have mis-filed it permanently in the v2 taxonomy.

Shipped as `claimreview-advisory`, dropping the proposal's `-investment` segment.

**Multi-page, without extra fetches.** The proposal is graded `multi-page`. It
consumes `ctx.pages`, which the orchestrator has already fetched and parsed, so
the audit issues no requests of its own.

Microdata is not parsed — only JSON-LD, including nodes nested inside `@graph`.
Every fact-check publisher in the evidence emits JSON-LD; adding a microdata
walker for this one advisory would not change any verdict it reaches.

## Deferred

Nothing. The sketch's six steps all ship, including the zero weight, which the
weight law derives from `weightForGrade('A', 'informative')` rather than
hard-coding.
