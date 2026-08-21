---
audit: technical-readiness/cors-api-routes
audit_id: "8.9"
category: technical-readiness
source_file: packages/core/src/audits/technical-readiness/cors-api-routes.ts
slug: cors-api-routes
review_verdict: delete
severity: high
evidence_grade: C
disposition: "proposed: redeem as scored (pending triage)"
reviewed: 2026-08-21
---

# cors-api-routes (`8.9`)

> technical-readiness · source `cors-api-routes.ts` · review verdict **delete** · evidence grade **C** · disposition: **proposed: redeem as scored (pending triage)**

## What it checks

Without CORS headers on your API routes, AI agents running in browser contexts (ChatGPT plugins, MCP clients, browser-based tools) cannot make cross-origin API requests. This blocks all agentic workflows that need to call your API on behalf of users.

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

## Evidence

### Signal: CORS headers on public AI files and API routes — grade C (technical-infra)

**Mechanism:** CLAIM UNDER TEST: serving Access-Control-Allow-Origin (typically '*') on llms.txt, .md mirrors, feeds and public JSON endpoints is required for AI agents to fetch and use them. FALSIFIABLE FORM: an AI consumer that can read a resource when ACAO is present fails to read the same resource when it is absent.

**Evidence:** The mechanism is real but its scope is much narrower than the audit implies. CORS matters only for code running inside a browser origin: MDN states 'browsers restrict cross-origin HTTP requests initiated from scripts', and the server merely opts in via ACAO. The genuine AI consumer class is browser-sandboxed agent code — OpenAI's Apps SDK widgets run in an isolated iframe under a strict CSP and must declare connect_domains (mapped to connect-src) for every origin they will fetch from; such a widget fetching a publisher's JSON or llms.txt cross-origin WILL be blocked without ACAO. That class is small today but growing.

**Counter-evidence:** Decisive counter-evidence for the general case: GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, PerplexityBot and every server-side agent backend are non-browser HTTP clients. They do not implement the same-origin policy and are completely unaffected by a missing Access-Control-Allow-Origin header. Browser extensions with host permissions (the Claude-in-Chrome / sidebar class) also bypass CORS. No AI vendor doc requires CORS on publisher resources, and the llms.txt spec says nothing about it. Therefore 'missing CORS blocks AI agents' is FALSE as a general claim. Recommend rewording the audit to target only browser-embedded agent consumption and demoting it out of the score.
**Consumers:** OpenAI Apps SDK widgets (browser-sandboxed), in-browser agent JS, none-known among server-side crawlers · **Recommended tier:** informative

**Sources:** [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS) · [Security & Privacy — Apps SDK](https://developers.openai.com/apps-sdk/guides/security-privacy) · [The /llms.txt file](https://llmstxt.org/) · [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) · [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
