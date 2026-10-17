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

## Example failure

A fact-checking desk plans a quarter of engineering work to extend ClaimReview markup across its archive, expecting AI answer engines to weight the signal. The markup is valid, so every structured-data validator returns green and nothing warns them that Google has announced it is phasing the format out of Search — the roadmap is built on a deprecating surface.

## Scoring

Tier per evidence policy: **informative (weight 0)** — grade A does not meet the A/B bar required for scored audits.

## Implementation deviations

- The audit reads `ctx.pages`, already fetched by the orchestrator. It issues
  no requests of its own.
- Microdata is not parsed. Only JSON-LD is read, including nodes nested in
  `@graph`. Fact-check publishers in the evidence emit JSON-LD.
