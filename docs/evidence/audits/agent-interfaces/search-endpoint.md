---
audit: agent-interfaces/search-endpoint
audit_id: "5.16"
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/search-endpoint.ts
slug: search-endpoint
review_verdict: fix
severity: high
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# search-endpoint (`5.16`)

> agent-tools · source `search-endpoint.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

A search endpoint lets AI agents find specific content on your site without crawling every page. When a user asks an agent "find pricing info on Example.com," the agent can use your search API directly. Add a Schema.org SearchAction or an OpenAPI search endpoint.

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

**Overlaps with:** `5.15`, `5.1`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-21 — evidence graded (see below).

## Graded evidence (2026-08-21)

**Mechanism claim:** An AI agent reads a site's `WebSite` → `potentialAction` → `SearchAction` `urlTemplate` (or a `GET /search` operation in its OpenAPI spec), substitutes the query term, and fetches results instead of crawling the site.

**Grade: C** — `SearchAction` is a ratified schema.org term with very large adoption, but its one documented consumer was retired by Google in 2024 and no vendor documents a named AI agent that reads it; the OpenAPI fallback inherits the unproven discovery leg graded in `5.1`.

**Evidence:**
- `SearchAction` is a stable schema.org type ("The act of searching for an object"), used as a `potentialAction` on `WebSite` with an `EntryPoint` `urlTemplate` carrying the query placeholder; schema.org's Google-index aggregation reports adoption on 10M+ domains — https://schema.org/SearchAction (verified 2026-08-21)
- Google retired the only documented consumer of that markup, the sitelinks search box, in October 2024 ("Farewell, Sitelinks Search Box"); the feature no longer appears in Search results and its documentation was archived — https://developers.google.com/search/blog/2024/10/sitelinks-search-box (verified 2026-08-21)
- The OpenAPI half of the signal depends on an agent obtaining the spec at all, which is documented only for developer-registered documents (GPT Actions, Copilot API plugins) — https://developers.openai.com/api/docs/actions/getting-started (verified 2026-08-21)

**Counter-evidence:** No crawler or agent documentation from OpenAI, Anthropic, Google, Microsoft, or Perplexity states that a named agent reads `SearchAction` to query a site rather than crawling or using a general web-search tool; the documented server-side tools those vendors ship (for example Anthropic's `web_search`/`web_fetch`) query the open web, not a site's declared search template. High markup adoption therefore reflects legacy SEO practice, not proven agent consumption — a community convention with a plausible but unverified mechanism.
