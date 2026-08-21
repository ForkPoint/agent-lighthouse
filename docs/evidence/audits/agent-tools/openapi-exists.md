---
audit: agent-tools/openapi-exists
audit_id: "5.1"
category: agent-tools
source_file: packages/core/src/audits/agent-tools/openapi-exists.ts
slug: openapi-exists
review_verdict: fix
severity: high
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# openapi-exists (`5.1`)

> agent-tools · source `openapi-exists.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

Without an OpenAPI spec, AI agents can only read your site but cannot take actions like submitting forms, searching, or booking demos. An OpenAPI spec turns your site from a passive document into an interactive tool that agents can use on behalf of users.

## Code review findings (2026-08-20, 11-agent pass)

Real signal (an OpenAPI spec is genuinely the highest-value agent-actionability artifact in 2026 — every LLM tool-calling stack converts one), but the implementation probes only two root paths and hard-fails the ~99% of sites that legitimately have no public API, poisoning the heaviest-weighted category. The YAML branch is a string sniff that can pass on an HTML soft-404.

**Required fix:** 1) Return `notApplicable()` instead of `fail()` when no spec is found anywhere and the site shows no other API surface — a marketing site has nothing to fix. 2) Validate the parsed object actually has `openapi` (3.x) or `swagger` (2.0) plus a `paths` object before passing. 3) Replace the YAML `includes('openapi:')` sniff with a real YAML parse and the same key validation, and require a non-HTML content-type. 4) Extend discovery: probe /api/openapi.json, /v1/openapi.json, /swagger.json, /api-docs, and honor `<link rel="service-desc">` and the `Link` response header. 5) When `ctx.wafProtection?.isBlocked`, report 'could not verify (blocked by <waf>)' rather than 'not found'.

**False-positive risks:**
- `yamlResult.body.includes('openapi:')` — any 200 HTML response containing the literal text `openapi:` passes. SPA hosts with catch-all rewrites return 200 text/html for /openapi.yaml; a docs page or a Swagger-UI HTML shell mentioning `openapi:` produces a false PASS. `FetchResult.contentType` is available and ignored.
- Only `/openapi.json` and `/openapi.yaml` are fetched (orchestrator.ts:217-218). Sites serving `/api/openapi.json`, `/v1/openapi.json`, `/swagger.json`, `/docs/openapi.yaml`, or advertising the spec via `<link rel="service-desc">` / `Link: rel="service-desc"` are reported as having no API at `high` priority — a false FAIL for most API-backed products.
- `this.fail(...)` with score 0 for every brochure site, blog, restaurant, and local-business site that has no API and never will. There is no `notApplicable` path even though audit.ts:44 documents exactly this case.
- A WAF/CDN returning 403 or a JS challenge for /openapi.json is indistinguishable from a genuine 404; `ctx.wafProtection` is never consulted.
- `isObject(parsed)` accepts ANY JSON object — `{"hello":1}` at /openapi.json passes as a 'Valid OpenAPI JSON spec'. There is no check for the `openapi`/`swagger` version key or a `paths` object.

**Test gaps:**
- No test that /openapi.yaml serving an HTML soft-404 containing 'openapi:' is rejected
- No test asserting a JSON object without an `openapi`/`swagger` key is not accepted as a spec
- No test for a spec at a non-root path or advertised via <link rel="service-desc">
- No 403/503/WAF-challenge fixture
- No redirect fixture (fetcher.ts pins finalUrl === url)

**Overlaps with:** `5.2`, `5.3`, `5.4`, `5.5`, `5.6`, `5.26`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
