---
audit: agent-interfaces/agents-json
audit_id: "5.10"
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/agents-json.ts
slug: agents-json
review_verdict: delete
severity: medium
evidence_grade: C
disposition: "informative, weight 0 (approved 2026-08-21)"
reviewed: 2026-08-21
---

# agents-json (`5.10`)

> agent-tools · source `agents-json.ts` · review verdict **delete** · evidence grade **C** · disposition: **informative, weight 0 (approved 2026-08-21)**

## What it checks

agents.json declares what AI agents can do on your site, including authentication methods, rate limits, and supported protocols. It helps agents self-configure before interacting with your services.

## Code review findings (2026-08-20, 11-agent pass)

Checks a real-but-stillborn convention, and checks it wrong: it validates nothing beyond 'is parseable JSON', while the remediation prescribes a schema that is not the actual agents.json schema. Any JSON file at that path passes, and anyone following the fix produces a file the real agents.json tooling cannot read.

**Required fix:** Delete. If retained despite near-zero adoption, it must at minimum (a) validate the real schema — `info` object plus a `sources` or `flows` array — instead of accepting any JSON, (b) correct `guidance.code` to the actual spec shape, and (c) become `informative`/`na` rather than a scored failure.

**False-positive risks:**
- Validation is `isObject(parsed) || Array.isArray(parsed)` — literally any parseable JSON passes. `[]`, `{}`, `null`-free garbage, or an unrelated config file at that path all yield 'agents.json found with valid JSON content'. This is a vacuous pass with no signal.
- The prescribed shape in `guidance.code` (`protocols`, `authentication`, `rate_limits`, `endpoints`) is invented. The actual agents.json spec is built around `$schema`, `info`, `sources` (pointing at OpenAPI documents) and `flows`. A user who follows this remediation writes a file no agents.json consumer can parse — actively harmful advice.
- Hard `fail` at medium priority for every site, since adoption is negligible.
- SPA catch-all HTML → 'agents.json is not valid JSON' rather than 'not present'.

**Test gaps:**
- No test that `[]` or `{}` passes (it does — the vacuous-pass hole is untested and unnoticed)
- No test validating against the real agents.json schema (`info`/`sources`/`flows`)
- No HTML-soft-404 fixture

**Overlaps with:** `5.7`, `5.11`, `5.12`

## Evidence

### Signal: agents-json — grade D (agent-action-surfaces)

**Mechanism:** Publishing an agents.json file (the Wildcard AI OpenAPI-derived contract describing flows, links and actions) lets AI agents discover and reliably invoke a site's API workflows.

**Evidence:** agents.json was a genuine 2025 proposal — an open spec layered on OpenAPI adding flows (chains of calls), links between actions, and agent-facing metadata — and it accumulated 1,314 stars and 66 forks, so it was not fringe at its peak.

**Counter-evidence:** The project is dead by every measurable signal, checked 2026-08-20. The repository wild-card-ai/agents-json has not been pushed since 2025-08-21 — twelve months stale — and its description field is now empty. Its declared homepage https://agents-json.com FAILS TO RESOLVE entirely (curl exit code 6 / HTTP 000). The documentation host docs.wild-card.ai serves an EXPIRED TLS certificate (valid 2026-01-09 to 2026-04-09, i.e. expired four months ago) so the spec itself is unreachable over HTTPS without an error. The spec version never advanced past 0.1.0. No agent vendor has ever documented consuming it, and there is no IANA registration. Auditing for agents.json would tell site owners to implement a specification whose own documentation site has been broken since April.
**Consumers:** none-known · **Recommended tier:** delete

**Sources:** [wild-card-ai/agents-json](https://github.com/wild-card-ai/agents-json) · [IANA Well-Known URIs registry](https://www.iana.org/assignments/well-known-uris/well-known-uris.xhtml)

### Signal: agent-surface-soft-404-validation — grade A (agent-action-surfaces)

**Mechanism:** A well-known or conventional agent-discovery path that returns HTTP 200 with an HTML body (an SPA catch-all rather than a real document) is worse than a 404, because a conforming client follows the standard, fails to parse, and has no recourse — so any audit must validate content-type and parseability, not status code.

**Evidence:** This is a meta-signal about how the other audits must be implemented, and it is the best-evidenced claim in the whole domain. The May 2026 API Evangelist study of 74 providers found that of the ~72 that did not serve a valid catalog, only TWO returned a clean 404 while SIXTY-EIGHT returned HTTP 200 with an HTML body, and concluded: 'an agent following the standard would get a 200, try to parse a LinkSet out of the body, fail, and have no useful recourse — an HTML 200 at a well-known path lies, which is worse than a 404.' My own probe on 2026-08-20 reproduced this independently across a different path set: linear.app returned 200 text/html for /openapi.json; github.com, linear.app, vercel.com and zapier.com returned 200 text/html for /mcp; zapier.com returned 200 text/html for /.well-known/ai-plugin.json. A status-code-only scanner would have reported all of these as adoption. Correct rule: require a JSON/YAML/linkset content-type, require the body to parse, and where a spec names a media type prefer it (application/ai-catalog+json for AI catalogs, application/linkset+json with the RFC 9727 profile for api-catalog, application/mcp-server-card+json for card entries) — Vercel demonstrates all of this is achievable in production.

**Counter-evidence:** None found — this is a validation-correctness requirement, not a contested adoption claim. The only nuance is that content negotiation is legitimate: RFC 9727 permits additional formats beyond the mandatory Linkset, so an audit should send an explicit Accept header before concluding a publisher is non-conformant, and should not penalise a clean 404 (which is honest) the way it penalises an HTML 200 (which is a lie).
**Consumers:** all clients following RFC 8615 well-known conventions · **Recommended tier:** scored

**Sources:** [Only Four API Providers Publish a Real .well-known/api-catalog Right Now](https://apievangelist.com/blog/2026/05/22/four-providers-publishing-well-known-api-catalog/) · [RFC 9727 — api-catalog: A Well-Known URI and Link Relation to Help Discovery of APIs](https://www.rfc-editor.org/rfc/rfc9727.html) · [experimental-ext-server-card — docs/discovery.md](https://raw.githubusercontent.com/modelcontextprotocol/experimental-ext-server-card/main/docs/discovery.md) · [Live deployment: Vercel /.well-known/api-catalog (RFC 9727)](https://vercel.com/.well-known/api-catalog) · [Live deployment: Vercel /.well-known/ai-catalog.json](https://vercel.com/.well-known/ai-catalog.json) · [Live deployment: Zapier /.well-known/api-catalog](https://zapier.com/.well-known/api-catalog)

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/agent-tools/agents-json.md](../../deletions/agent-tools/agents-json.md). Outcome: **dead**, grade C.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
