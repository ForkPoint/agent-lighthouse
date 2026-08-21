---
audit: agent-tools/openapi-servers
audit_id: "5.5"
category: agent-tools
source_file: packages/core/src/audits/agent-tools/openapi-servers.ts
slug: openapi-servers
review_verdict: fix
severity: high
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# openapi-servers (`5.5`)

> agent-tools · source `openapi-servers.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

Without a servers array, AI agents do not know the base URL for your API. They cannot construct valid request URLs, rendering the entire spec unusable. Add at least your production server URL.

## Code review findings (2026-08-20, 11-agent pass)

Correct premise (agents need a base URL) wrecked by liveness probing that misreads normal API behavior as breakage. It GETs the bare server URL and treats anything outside 2xx/3xx as a problem, so healthy production APIs that 401/404/405 on their base path are reported as broken at high priority.

**Required fix:** Stop treating a bare GET as a liveness test. Validate structure instead: servers array non-empty, each `url` parseable (resolving relative URLs against `ctx.baseUrl` and substituting `variables` defaults), and https for production. If a liveness probe is kept, probe a concrete path from `paths` rather than the base, accept 401/403/405 as 'reachable', skip localhost/example.com entries, and downgrade unreachable to informational.

**False-positive risks:**
- `await ctx.fetch({ url: serverUrl })` then `result.status >= 200 && < 400` — most REST base URLs return 404 (no route at /v1), 401 (auth required), or 405 (method not allowed) for a bare GET. `https://api.stripe.com/v1` style bases warn as 'returned HTTP 401/404' despite being perfectly reachable and correct.
- Relative server URLs are legal in OpenAPI 3 (`"servers": [{"url": "/api"}]`). `ctx.fetch({url: '/api'})` has no base to resolve against → undici throws or 0-status → 'could not be reached' warn on a fully valid spec.
- Server URL templating is legal and common (`"url": "https://{region}.api.example.com/{version}"` with a `variables` object). The literal braces are never substituted, so the fetch targets a nonexistent host → false warn.
- Only the FIRST entry with a url is probed (`servers.find(...)`). Specs conventionally list a mock/sandbox or `http://localhost:8080` first for local dev; that entry fails while production is fine.
- A WAF or rate-limiter answering the probe with 403/429 produces the same warn as a genuinely dead server; `ctx.wafProtection` unused.
- Same JSON-only loader bug as 5.2-5.6.

**Test gaps:**
- No relative-URL server fixture (`{"url": "/api"}`)
- No server-variables/templated-URL fixture
- No 401/405 fixture (the two most common healthy responses to a bare base GET)
- No multi-server fixture with localhost or a sandbox first
- Test at line 32 asserts 404 → warn, i.e. it locks in the false positive rather than exposing it

**Overlaps with:** `5.1`, `5.9`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
