---
audit: agent-interfaces/search-endpoint
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/search-endpoint.ts
slug: search-endpoint
evidence_grade: D
disposition: "obsolete tier (2026-10-18)"
reviewed: 2026-10-18
consumers:
  - none (Google's sitelinks search box, the only documented consumer, was removed 2024-11-21)
sources:
  - google-sitelinks-searchbox-farewell
  - schema-searchaction
  - openai-gpt-actions-openapi
recommended_tier: obsolete
---

# search-endpoint (`5.16`, `3.4`)

> agent-interfaces · source `search-endpoint.ts` · absorbs website-search-action (3.4) · evidence grade **D** · tier **obsolete** (weight 0, never fails)

## What it checks

Whether any sampled page still publishes a Schema.org `SearchAction`, usually as the `potentialAction` of a `WebSite` node. The search URL is not probed: the markup is the finding.

The OpenAPI search-operation half of the old audit is gone. It had no consumer and no retirement notice to report.

| State                                                                       | Result                 |
| :-------------------------------------------------------------------------- | :--------------------- |
| a `SearchAction` on any sampled page, with or without a usable URL template | `warn`, priority `low` |
| no `SearchAction`, including a `WebSite` node without one                   | `notApplicable`        |

## Claimed mechanism (falsifiable)

**Mechanism:** Google read `SearchAction` to show a search box under a site's result. The claim this audit tests is that Google retired that box and that no AI vendor reads the markup, so it no longer does anything.

## Evidence

- Google: "we'll be removing this visual element starting on November 21, 2024." — [Farewell, sitelinks search box](https://developers.google.com/search/blog/2024/10/sitelinks-search-box) (verified 2026-10-18)
- The same post: "While you can remove sitelinks search box structured data from your site, there's no need to do so. Unsupported structured data like this won't cause issues in Search." It adds that site names use a variation of `WebSite` structured data.
- No AI vendor documents reading `SearchAction`.

**Counter-evidence:** Google says removal is unnecessary and that `WebSite` markup still feeds site names. The message therefore says removal is optional and tells the owner to keep the `WebSite` node.

## Scoring

**Grade: D** — the only documented consumer was retired by its operator. An obsolete audit carries weight 0 and never returns `fail` (`sunset.test.ts`; `Audit.toCheckResult` lowers a stray `fail` to `warn`). It does not move any score.

## Example finding

The homepage JSON-LD has a `WebSite` with `potentialAction: SearchAction`. The report says the sitelinks search box is gone, that removing the action is optional, and that the `WebSite` node should stay.

## Implementation deviations

- 2026-10-18: moved from informative (grade C) to the obsolete tier (grade D).
- The probe of the search URL and the OpenAPI half were removed. The audit no longer makes a request.
- An unusable `SearchAction` (no template, no placeholder) is reported the same way as a usable one.

## Record before the obsolete tier

The dossier as it stood before the move on 2026-10-18. Kept as the research record; withheld from the public page.

### What it checks

One site-search audit over both halves of the declaration: the Schema.org `SearchAction` URL template, and a `GET` search operation in the OpenAPI spec.

| State                                                                                                                                                  | Result                 |
| :----------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| a `SearchAction` URL template whose probe returns HTTP 200 **with results**, or a `GET` operation on a path with a `search` segment in `/openapi.json` | `pass`                 |
| a `SearchAction` template that 200s with an empty payload, is gated (401/403/407/451), returns another non-200, or is unreachable                      | `warn`, priority `low` |
| a `SearchAction` whose target has no `urlTemplate` or no `{placeholder}`                                                                               | `warn`, priority `low` |
| neither half present, including a `WebSite` node that declares no `SearchAction` at all                                                                | `notApplicable`        |

### Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

### Evidence (2026-08-21)

**Mechanism claim:** An AI agent reads a site's `WebSite` → `potentialAction` → `SearchAction` `urlTemplate` (or a `GET /search` operation in its OpenAPI spec), substitutes the query term, and fetches results instead of crawling the site.

**Grade: C** — `SearchAction` is a ratified schema.org term with very large adoption. But its one documented consumer was retired by Google in 2024, and no vendor documents a named AI agent that reads it. The OpenAPI fallback inherits the unproven discovery leg graded in `5.1`.

**Evidence:**

- `SearchAction` is a stable schema.org type ("The act of searching for an object"), used as a `potentialAction` on `WebSite` with an `EntryPoint` `urlTemplate` carrying the query placeholder; schema.org's Google-index aggregation reports adoption on 10M+ domains — https://schema.org/SearchAction (verified 2026-08-21)
- Google retired the only documented consumer of that markup, the sitelinks search box, in October 2024 ("Farewell, Sitelinks Search Box"); the feature no longer appears in Search results and its documentation was archived — https://developers.google.com/search/blog/2024/10/sitelinks-search-box (verified 2026-08-21)
- The OpenAPI half of the signal depends on an agent obtaining the spec at all, which is documented only for developer-registered documents (GPT Actions, Copilot API plugins) — https://developers.openai.com/api/docs/actions/getting-started (verified 2026-08-21)

**Counter-evidence:** No crawler or agent documentation from OpenAI, Anthropic, Google, Microsoft or Perplexity states that a named agent reads `SearchAction` to query a site, rather than crawling it or using a general web-search tool. The documented server-side tools those vendors ship — Anthropic's `web_search` and `web_fetch`, for example — query the open web, not a site's declared search template. High markup adoption therefore reflects legacy SEO practice, not proven agent consumption — a community convention with a plausible but unverified mechanism.

### Implementation deviations

- The audit absorbs website-search-action (3.4). Its record is `docs/evidence/merged/agent-interfaces/website-search-action.md`.
- JSON-LD goes through `flattenJsonLd`, preferring `page.structuredData`. `@type` and `target` are array-coerced, and every `WebSite` node on every crawled page is scanned.
- Both target shapes count: a bare string and an `EntryPoint` with `urlTemplate`.
- Every `{placeholder}` is substituted before the probe. A 200 must carry results; an empty shell warns. 401, 403, 407 and 451 are reported as gated.
- The OpenAPI half matches a `GET` on a path with a `\bsearch\b` segment, read through `gatherers/openapi.ts`.
- `applicablePageTypes` is not set. This is a site-level check.
- `query-input` is not cross-checked against the placeholder. The probe verifies the template instead.
- The audit is not enrolled in the absent-artifact contract. A `SearchAction` alone can reach a verdict without any OpenAPI document.
- When neither half is present, the audit returns `notApplicable` (absent artifact, absent verdict). Until 2026-10-18 it returned `fail`, and a `WebSite` node without a `SearchAction` returned `warn`, although no consumer reads the declaration.

### Deferred

- A rendered "no results" page that still carries prose passes. Telling it apart from a result list needs per-site heuristics.
- The OpenAPI half is JSON-only.
