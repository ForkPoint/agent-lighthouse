---
audit: agent-interfaces/cors-api-routes
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/cors-api-routes.ts
slug: cors-api-routes
evidence_grade: C
disposition: "kept — rebuilt spec-driven, na without an API surface 2026-08-22 (Plan 4, Task 16)"
reviewed: 2026-08-22
recommended_tier: informative
consumers:
  - OpenAI Apps SDK widgets (browser-sandboxed)
  - in-browser agent JS
  - none-known among server-side crawlers
signals:
  - name: CORS headers on public AI files and API routes
    grade: C
    domain: technical-infra
sources:
  - mdn-cors
  - openai-apps-sdk-security
  - llmstxt-spec-link
  - s18
  - anthropic-crawlers
---

# cors-api-routes (`8.9`)

> agent-interfaces · source `cors-api-routes.ts` · evidence grade **C** · tier **informative** (weight 0) · rebuilt from a hardcoded `/api/` probe to spec-driven probing of the endpoints the OpenAPI document declares — see below

## What it checks

CORS matters for one class of AI consumer: agent code running inside a browser origin, such as an OpenAI Apps SDK widget in an isolated iframe under a strict CSP. Server-side crawlers and MCP clients are not browsers and are unaffected. The audit reads the endpoints out of the published OpenAPI document, probes those, and applies only to sites that publish one.

_(The pre-rewrite description claimed a missing ACAO "blocks all agentic workflows". That is false for the majority of the named consumers; the refutation is in the rewrite section below.)_

## Code review findings (2026-08-20, 11-agent pass)

Probes a hardcoded `${ctx.baseUrl}/api/` with OPTIONS and fails the site when no ACAO comes back — but only after gating on an OpenAPI spec existing at the site root. Both halves are broken. The gate looks for `/openapi.json`, `/openapi.yaml`, `/swagger.json`, and `/swagger.json` is never fetched by the orchestrator at all (its `rootFilePaths` list has no such entry), so that arm is dead code. The probe assumes every API in the world lives at `/api/`, which the OpenAPI document it just found would actually tell it (`servers[].url`, per-path entries) — the spec is used as a boolean and its contents are discarded. On a site whose API is at `/v1/`, `/graphql`, or `api.example.com`, `/api/` is a 404 (or an SPA HTML fallback) with no ACAO, and the audit reports 'API routes are missing CORS headers. AI agents cannot make cross-origin API requests' at priority `high` about routes that do not exist.

**Required fix:** Delete as written. If a CORS-on-API signal is wanted, rebuild it spec-driven: parse the discovered OpenAPI document, resolve `servers[].url` plus one or two real declared paths, probe THOSE with both OPTIONS and GET, require an ACAO that would actually admit a third-party origin, and return `notApplicable()` (not warn) whenever no spec or no same-origin API surface exists. Add '/swagger.json' to the orchestrator's rootFilePaths or drop it from the audit so the dead arm stops silently mis-gating.

**False-positive risks:**
- Hardcoded path: `ctx.fetch({url: `${ctx.baseUrl}/api/`, method: 'OPTIONS'})`. APIs at /v1/, /graphql, /rest/, or a separate api. subdomain → 404/HTML fallback → no ACAO → high-priority FAIL about a nonexistent endpoint.
- Spec contents ignored: `hasOpenApi` is computed as a boolean from `ctx.rootFiles[p].status === 200`; `servers[]` and the path list inside the spec — the authoritative answer to 'where are the API routes' — are never parsed.
- Dead gate arm: '/swagger.json' is in the audit's `openapiPaths` but is not in the orchestrator's `rootFilePaths`, so `ctx.rootFiles['/swagger.json']` is always undefined. Sites that publish only swagger.json are silently routed to the 'No OpenAPI spec found' warn.
- Absence penalized: no spec ⇒ `warn` (0.5) rather than `na`, so every ordinary content site loses half a point on an API check that does not apply to it.
- Soft-404: an SPA rewrite answers OPTIONS /api/ with 200 + index.html and no ACAO → fail; another rewrite that adds permissive CORS site-wide → pass, both without any API existing.
- Presence-only ACAO (`acaoValue.length > 0`) passes on a narrow origin that no agent will match; the redirect retry only handles 3xx from the trailing-slash form and not the reverse.
- The MCP/agent story has moved server-side: MCP clients and crawler-side agents are not browsers and are unaffected by CORS, so the 'blocks all agentic workflows' framing is wrong for the majority of the named consumers.

**Test gaps:**
- No test where the OpenAPI spec declares `servers: [{url: 'https://api.example.com/v1'}]` and the API is not under /api/.
- No test for /swagger.json (the dead gate arm) — the bug is invisible to the suite.
- No test for an SPA 200-HTML fallback on OPTIONS /api/.
- No test that 'no spec' yields `na` rather than a scored warn.
- No test asserting that a same-origin-only ACAO is insufficient (the existing test asserts it passes).

**Overlaps with:** `8.8`

## The spec-driven rewrite (Plan 4, Task 16, 2026-08-22)

**Old pass condition:** an OpenAPI spec exists at one of three root paths (used as a boolean), **and** `OPTIONS ${baseUrl}/api/` answers with any non-empty `Access-Control-Allow-Origin`. No spec ⇒ `warn`. No ACAO ⇒ **fail** at `high` priority.

**New pass condition:** an endpoint the OpenAPI document *itself declares* answers with `Access-Control-Allow-Origin: *`. A narrower ACAO warns, no ACAO warns, and a site publishing no OpenAPI document is `notApplicable`. The audit can no longer fail.

### Rebuilt exactly as the required fix specifies

- **Parse the document, do not use it as a boolean.** `servers[].url` and the `paths` keys are the authoritative answer to "where are the API routes", and the old audit read the spec only to decide whether to probe a hardcoded `/api/`. On a site whose API is at `/v1`, `/graphql` or `api.example.com`, `/api/` is a 404 or an SPA HTML fallback with no ACAO, and the audit reported "API routes are missing CORS headers" at `high` priority about routes that do not exist.
- **Resolve `servers[].url` plus real declared paths.** Server URLs are resolved against the site base when relative; OpenAPI's documented default (`/`) applies when no `servers` array is present; `{variable}` templates are expanded from their declared `default`, and a template left unresolved is dropped rather than probed with braces in the URL. Paths are filtered to concrete ones — a `{id}` probe would 404 on a working API and read as missing CORS — and at most two endpoints are probed.
- **Probe with both OPTIONS and GET.** The preflight is what a browser sends first, but some servers attach CORS headers only to the actual request, so GET is the documented fallback. The old trailing-slash redirect retry is gone with the guessed path that needed it.
- **Require an ACAO that would actually admit a third party.** `*` passes. A single named origin warns — it admits that origin and nothing else, so a browser-sandboxed agent elsewhere is still blocked — and a same-origin-only value is called out as admitting no third party at all. The old presence-only test (`acaoValue.length > 0`) passed both, and the old test suite asserted that a narrow origin *should* pass.
- **`notApplicable`, not `warn`, when there is no spec.** Every ordinary content site was losing half a point on an API check that did not apply to it.
- **The dead `/swagger.json` arm is dropped.** It is not in the orchestrator's `rootFilePaths`, so `ctx.rootFiles['/swagger.json']` was always `undefined` and a site publishing only that file was silently routed to the "no spec" warn. Removing it from the audit is the alternative the required fix offers, and is the honest one while the orchestrator does not fetch it.
- **Soft-404 gating.** `/openapi.json` must be a 200 that is not `text/html` and must parse to a document with a version key and a `paths` object, so an SPA catch-all no longer counts as an API surface.

### SSRF gate

`servers[].url` is site-controlled and may be absolute, so the rewrite introduces a fetch to a host the scanner did not choose. Every target passes `isSafeUrl()` before it is probed, the same way `openapi-exists` and `mcp-endpoint` gate the URLs they harvest; a refused target warns with the reason. The audit's test suite mocks the fetcher module so no test performs a DNS lookup.

### The false framing is corrected

The shipped copy said a missing ACAO "blocks all agentic workflows that need to call your API on behalf of users", and named "ChatGPT plugins, MCP clients, browser-based tools" as the affected consumers. GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, PerplexityBot, every server-side agent backend and every MCP client are non-browser HTTP clients: they do not implement the same-origin policy and are completely unaffected by a missing ACAO. Browser extensions with host permissions bypass CORS too. The audit now names the one class the evidence supports — browser-sandboxed agent code such as an OpenAI Apps SDK widget, which runs in an isolated iframe under a strict CSP and must declare `connect_domains` for every origin it fetches from — and states explicitly that nothing else is affected.

### Grade and tier decision: **C**, tier `informative`, weight 0 — target tier `scored` not reachable

The REWORK-TODO row proposed `scored`. It cannot land: the evidence signal below is graded **C** with a recommended tier of `informative` and an explicit instruction to "demot[e] it out of the score". Under the §4 weight law `weightForGrade('C', 'scored') = 0`, while `sunset.test.ts` enforces `tier !== 'scored' ⟺ weight === 0`, so grade C in the `scored` tier is not a registrable state — the same resolution recorded for `openapi-link` and, in this wave, for `direct-definitions`. The substantive half of the row — "notApplicable unless site exposes a public API surface agents would call cross-origin" — landed in full. `scoreDisplayMode` stays `informative`; `defaultPriority` drops `medium` → `low`.

### Re-check trigger

The evidence calls the browser-sandboxed agent class "small today but growing". If a vendor documents a browser-sandboxed agent that requires publisher-side ACAO, or the Apps SDK class becomes a mainstream consumer of third-party APIs, the grade should be re-examined — the pass condition is already written against exactly that consumer.

## Evidence

### Signal: CORS headers on public AI files and API routes — grade C (technical-infra)

**Mechanism:** The claim under test: serving Access-Control-Allow-Origin (typically '*') on llms.txt, .md mirrors, feeds and public JSON endpoints is required for AI agents to fetch and use them. FALSIFIABLE FORM: an AI consumer that can read a resource when ACAO is present fails to read the same resource when it is absent.

**Evidence:** The mechanism is real but its scope is much narrower than the audit implies. CORS matters only for code running inside a browser origin: MDN states 'browsers restrict cross-origin HTTP requests initiated from scripts', and the server merely opts in via ACAO. The genuine AI consumer class is browser-sandboxed agent code. OpenAI's Apps SDK widgets run in an isolated iframe under a strict CSP, and must declare connect_domains — mapped to connect-src — for every origin they will fetch from. Such a widget fetching a publisher's JSON or llms.txt cross-origin will be blocked without ACAO. That class is small today but growing.

**Counter-evidence:** Decisive counter-evidence for the general case: GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, PerplexityBot and every server-side agent backend are non-browser HTTP clients. They do not implement the same-origin policy and are completely unaffected by a missing Access-Control-Allow-Origin header. Browser extensions with host permissions (the Claude-in-Chrome / sidebar class) also bypass CORS. No AI vendor doc requires CORS on publisher resources, and the llms.txt spec says nothing about it. Therefore 'missing CORS blocks AI agents' is false as a general claim. Recommend rewording the audit to target only browser-embedded agent consumption and demoting it out of the score.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-22 — user approved the pending-triage redeem; required rework executed (Plan 4, Task 16): probing is spec-driven off `servers[].url` and the declared concrete paths (variables expanded, templates skipped, capped at two), OPTIONS with a GET fallback, `isSafeUrl()` gate on every target, an ACAO must admit a third-party origin to pass, `na` when no OpenAPI document is published, the dead `/swagger.json` arm removed, and the "blocks all agentic workflows" framing replaced with the browser-sandboxed consumer class the evidence supports. Grade C, tier `informative`, weight 0 — the row's proposed `scored` target is unreachable for a grade-C audit under the §4 weight law and the registry invariant, and the evidence's own recommended tier is `informative`. `defaultPriority` `medium` → `low`. `TODO(redeem)` marker removed from the source file.
