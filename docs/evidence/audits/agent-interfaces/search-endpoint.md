---
audit: agent-interfaces/search-endpoint
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/search-endpoint.ts
slug: search-endpoint
evidence_grade: C
disposition: "merged 2026-08-22 (Plan 4, Task 7) — absorbs website-search-action (3.4)"
reviewed: 2026-08-22
sources:
  - schema-searchaction
  - google-sitelinks-searchbox-farewell
  - openai-gpt-actions-openapi
---

# search-endpoint (`5.16`, `3.4`)

> agent-interfaces · source `search-endpoint.ts` · merged site-search audit, absorbs website-search-action (3.4) · evidence grade **C** · tier **informative** (weight 0)

## What it checks

One site-search audit over both halves of the declaration: the Schema.org `SearchAction` URL template, and a `GET` search operation in the OpenAPI spec.

| State                                                                                                                                                  | Result                 |
| :----------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| a `SearchAction` URL template whose probe returns HTTP 200 **with results**, or a `GET` operation on a path with a `search` segment in `/openapi.json` | `pass`                 |
| a `SearchAction` template that 200s with an empty payload, is gated (401/403/407/451), returns another non-200, or is unreachable                      | `warn`, priority `low` |
| a `SearchAction` whose target has no `urlTemplate` or no `{placeholder}`, or a `WebSite` node that declares no `SearchAction` at all                   | `warn`, priority `low` |
| neither half present                                                                                                                                   | `fail`, priority `low` |

## Code review findings (2026-08-20, 11-agent pass)

Good signal, but the JSON-LD matcher misses the single most common real-world shape — `potentialAction` as an array — so sites that correctly publish a SearchAction are reported as having no search endpoint. It also calls a 200 response 'functional' without checking that any results came back.

**Required fix:** Normalize before matching: run the blocks through `flattenJsonLd()` (parser.ts) and prefer `page.structuredData` over `page.jsonLd`; coerce `@type` and `potentialAction` to arrays before comparing. Use a global regex (`/\{[^}]*\}/g`) so every placeholder is substituted. Verify functionality rather than assuming it — require the response to be non-trivial (contains result markup or a non-empty JSON array), and treat 403/redirect-to-login distinctly from a broken endpoint. Tighten the OpenAPI path match to a path segment (`/\bsearch\b/`) instead of a substring.

**False-positive risks:**

- `isObject(obj['potentialAction'])` (line 58) rejects arrays. Publishing `"potentialAction": [{"@type":"SearchAction",...}, {"@type":"ReadAction",...}]` is standard, extremely common (WordPress/Yoast, many CMS templates), and fully valid — every such site gets a false FAIL.
- `obj['@type'] === 'SearchAction'` and `=== 'WebSite'` are strict string comparisons; `@type` is legally an array (`"@type": ["WebSite", "Organization"]`), which never matches.
- Recursion only descends into `@graph`. A SearchAction nested under `mainEntity`, `about`, or inside a top-level JSON-LD array is missed. parser.ts already ships `flattenJsonLd()` (parser.ts:44) built precisely to solve this, and `PageContext.structuredData` exists — this audit uses neither, reading only `page.jsonLd`.
- `searchUrl.replace(/\{[^}]*\}/, 'test')` replaces only the FIRST placeholder (no `g` flag). A template like `/search?q={search_term_string}&lang={lang}` keeps a literal `{lang}` in the fetched URL → 400/404 → false warn.
- 'Functional' is asserted from `status === 200` alone. Every SPA search route returns 200 with an empty shell; a 200 soft-404 'no results' page also passes. The audit claims functionality it never verified — and conversely a search page that 403s behind a WAF or 302s to a login is warned as broken.
- OpenAPI fallback matches `path.toLowerCase().includes('search')` on any GET, so `GET /research/papers` or `GET /searchindex/status` passes as a search endpoint.
- Reuses the JSON-only `getOpenApiSpec()` copy.

**Test gaps:**

- No array-valued `potentialAction` fixture — the highest-impact miss
- No array-valued `@type` fixture
- No multi-placeholder urlTemplate fixture
- No fixture where the search URL 200s but returns a 'no results' / empty SPA shell
- No fixture using `structuredData` (microdata/RDFa) rather than raw jsonLd
- No 403/WAF or redirect-to-login fixture

**Overlaps with:** `5.15`, `5.1`, `3.4` (now absorbed here)

## The merge (Plan 4, Task 7, 2026-08-22)

3.4 and 5.16 were the same audit written twice. 3.4 read `WebSite` → `potentialAction` → `SearchAction` and graded the markup; 5.16 read the same markup and probed the URL — and both got the JSON-LD wrong in the same way, rejecting the array-valued `potentialAction` that Yoast, Rank Math, Squarespace and Shopify all emit. A site with correct, extremely common markup was told twice that it has no search endpoint.

**What the merged audit does.** The Schema.org half is now normalized before matching: blocks go through the shared deep flattener (`flattenJsonLd`) reading `page.structuredData` in preference to `page.jsonLd`, `@type` and `target` are both array-coerced, and a `SearchAction` nested under `mainEntity` or inside a top-level array is found the same way one under `@graph` is. Every `WebSite` node is scanned rather than `[0]`. Both target shapes are accepted — the bare string and the schema.org-canonical `EntryPoint` with `urlTemplate` — which removes 3.4's inverted quality gradient, where the _more_ correct markup failed.

**Probing is now verification, not assumption.** `status === 200` proved nothing: every SPA search route answers 200 with an empty shell. A 200 now has to carry a payload — a non-empty array or positive result count for JSON, some visible text once scripts, styles and tags are stripped for markup — and a gated response (401/403/407/451) is reported as _gated_, not as broken. Every `{placeholder}` in the template is substituted (the old single-replace left a literal `{lang}` in `/search?q={q}&lang={lang}` and manufactured a 404).

**The OpenAPI half is tightened to a path segment.** `path.includes('search')` accepted `GET /research/papers` and `GET /searchindex/status` as search APIs; the match is now `\bsearch\b`, which still accepts `/api/product-search`.

**3.4's warn state survives as the declared-but-incomplete branch**, which is the one thing 5.16 could not express: a `WebSite` node with no `SearchAction`, or a `SearchAction` with an unusable target, is a different verdict from declaring nothing at all.

### Absorbed evidence — website-search-action (3.4)

3.4's dossier is kept verbatim at [merged/agent-interfaces/website-search-action.md](../../merged/agent-interfaces/website-search-action.md) (grade **D**, recommended tier _delete_). It is the sharper of the two evidence records and it argues _against_ the signal: `SearchAction` is on 6.6M domains — the fourth most common JSON-LD class in the October 2024 Common Crawl — and its only mainstream consumer, Google's sitelinks search box, was withdrawn globally on 21 November 2024. The two consumers that do exist are honestly narrow: Applebot's archived pre-Apple-Intelligence documentation lists `SearchAction` among supported schemas, and Gmail genuinely executes `potentialAction`, but only `ConfirmAction`/`SaveAction`, in email, not on web pages. Google's own agent-friendly guidance describes agents working from screenshots, DOM and the accessibility tree and never mentions schema.org.

That is textbook zombie adoption, and it is why this audit is `informative` and why its guidance now says so in the `impact` string instead of asserting ChatGPT behaviour that has never been demonstrated.

### Grade decision: stays **C**, tier `informative`, weight 0

5.16 grades **C** and 3.4 grades **D**; the absorbed evidence is weaker, not stronger, so the grade does not move. The merged audit keeps 5.16's **C**, which rests on `SearchAction` being a ratified schema.org term with very large adoption plus an OpenAPI fallback whose discovery leg is itself unproven (graded in 5.1) — no vendor documents a named agent that reads either. Tier stays `informative`, so `weightForGrade('C', 'informative')` is **0** and the check never moves a score.

`scoreDisplayMode` stays `informative` — the ledger law in `sunset.test.ts` requires a non-`scored` tier to render as informative, so the new middle state cannot be spelled `ternary` here. `defaultPriority` drops from `medium` to `low` per 3.4's required fix: a signal with no documented consumer should not be raised above a site's real problems.

### Deviations

- **`applicablePageTypes` is not set.** 3.4 declared `['homepage']` while scanning every page, which its review flags as incoherent. The merged audit is a site-level check — it also reads `ctx.rootFiles['/openapi.json']` — so the gate is dropped rather than fixed, and a `SearchAction` on any crawled page counts.
- **`query-input` is not cross-checked against the placeholder name.** 3.4's required fix asks for it. The probe supersedes it: a template that resolves and returns results is verified regardless of whether `query-input` names the same parameter, and a template with no placeholder at all is already caught.
- **A soft-404 "no results" page that still renders prose passes.** The payload check catches the empty SPA shell and the empty JSON array, which is what the required fix names; distinguishing a rendered "nothing found" page from a rendered result list would need per-site heuristics and is left open.
- **The JSON-only `getOpenApiSpec()` copy stays.** The OpenAPI half still reads `/openapi.json` and not `/openapi.yaml`. Deduplicating the several private copies across the openapi-* audits is a refactor of audits this fold does not touch.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-21 — evidence graded (see below).
- 2026-08-21 — approved: 3.4 merges away into 5.16 (v2 audit map).
- 2026-08-22 — merged (Plan 4, Task 7); registry 160 → 159 for this fold.

## Evidence (2026-08-21)

**Mechanism claim:** An AI agent reads a site's `WebSite` → `potentialAction` → `SearchAction` `urlTemplate` (or a `GET /search` operation in its OpenAPI spec), substitutes the query term, and fetches results instead of crawling the site.

**Grade: C** — `SearchAction` is a ratified schema.org term with very large adoption. But its one documented consumer was retired by Google in 2024, and no vendor documents a named AI agent that reads it. The OpenAPI fallback inherits the unproven discovery leg graded in `5.1`.

**Evidence:**

- `SearchAction` is a stable schema.org type ("The act of searching for an object"), used as a `potentialAction` on `WebSite` with an `EntryPoint` `urlTemplate` carrying the query placeholder; schema.org's Google-index aggregation reports adoption on 10M+ domains — https://schema.org/SearchAction (verified 2026-08-21)
- Google retired the only documented consumer of that markup, the sitelinks search box, in October 2024 ("Farewell, Sitelinks Search Box"); the feature no longer appears in Search results and its documentation was archived — https://developers.google.com/search/blog/2024/10/sitelinks-search-box (verified 2026-08-21)
- The OpenAPI half of the signal depends on an agent obtaining the spec at all, which is documented only for developer-registered documents (GPT Actions, Copilot API plugins) — https://developers.openai.com/api/docs/actions/getting-started (verified 2026-08-21)

**Counter-evidence:** No crawler or agent documentation from OpenAI, Anthropic, Google, Microsoft or Perplexity states that a named agent reads `SearchAction` to query a site, rather than crawling it or using a general web-search tool. The documented server-side tools those vendors ship — Anthropic's `web_search` and `web_fetch`, for example — query the open web, not a site's declared search template. High markup adoption therefore reflects legacy SEO practice, not proven agent consumption — a community convention with a plausible but unverified mechanism.

## Implementation deviations

**2026-08-29 — the OpenAPI read and the `paths` walk moved to
`packages/core/src/gatherers/openapi.ts`.** This file carried a private copy of
both, which is the drift the shared module exists to end. No verdict moved: the
shared walk visits path items in the same order and applies the same "is the
`get` value an object" test, so the first `\bsearch\b` path with a GET is still
the one reported.

This audit is deliberately **not** enrolled in the absent-artifact contract. It
judges whether a site offers a search interface at all, and a `SearchAction` in
JSON-LD or an on-page search form is evidence enough to reach a verdict without
any OpenAPI document. The absence of the document is not the absence of the
thing it audits.
