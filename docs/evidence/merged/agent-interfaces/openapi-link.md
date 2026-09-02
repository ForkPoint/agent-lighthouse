---
audit: agent-interfaces/openapi-link
audit_id: "4.18"
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/openapi-link.ts
slug: openapi-link
review_verdict: delete
severity: medium
evidence_grade: B
disposition: "proposed: redeem as scored (pending triage)"
reviewed: 2026-08-21
---

# openapi-link (`4.18`)

> meta-tags · source `openapi-link.ts` · review verdict **delete** · evidence grade **B** · disposition: **proposed: redeem as scored (pending triage)**

## What it checks

AI agents use OpenAPI specifications to understand your API endpoints, parameters, and response formats. An OpenAPI link in <head> enables agents to programmatically interact with your API without manual documentation parsing, powering agentic workflows that call your services.

## Code review findings (2026-08-20, 11-agent pass)

Invented discovery mechanism wrapped around a real artifact, and it fires on every site including the vast majority that have no public API at all. A site with an excellent, well-published OpenAPI spec fails this audit unless it happens to have added a head link whose English title contains 'openapi'. The failure text ('blocks agentic workflows that could call your API services') is wrong for such a site.

**Required fix:** Delete from meta-tags. A meaningful OpenAPI check probes for the spec itself (/.well-known/, /openapi.json, /swagger.json, documented URLs) and validates its contents — which is agent-tools territory, not head-meta territory. If any head-link hint is retained here, it must (a) return `notApplicable()` when the site exposes no API surface rather than failing every brochure site, (b) match on href (`/openapi\.(json|ya?ml)$/i`) rather than on `title.includes('openapi')`, and (c) accept `application/yaml`/`text/yaml`, since a large share of specs are YAML and the current `type === 'application/json'` requirement excludes them outright.

**False-positive risks:**

- Title-dependence: `(l.title ?? '').toLowerCase().includes('openapi')` makes an optional, English, human-authored attribute the sole discriminator. `<link rel="alternate" type="application/json" href="/openapi.json">` with no title, or `title="API-Spezifikation"`, fails.
- YAML specs excluded by construction: `l.type === 'application/json'` cannot match `application/yaml`, `text/yaml`, or `application/vnd.oai.openapi`, so a site publishing openapi.yaml fails no matter how it links it.
- `type="application/json; charset=utf-8"` fails the exact comparison.
- `l.rel === 'alternate'` exact and case-sensitive.
- No applicability gate: every site without an API — blogs, brochure sites, local businesses — receives a scored failure telling them agentic workflows are blocked, which is meaningless for them. The guidance text itself hedges ('If your site has an API'), but the code does not.
- Only `ctx.pages[0]` is examined; developer-facing link tags usually live on /docs or /developers, not the marketing homepage.
- The spec's real locations (/.well-known/, /openapi.json, documented URLs) are never probed even though `ctx.fetch` and `ctx.rootFiles` are available.

**Test gaps:**

- No YAML spec test.
- No title-less link test.
- No non-English title test.
- No no-API site test that should be `na`.
- No /.well-known/ or /openapi.json probe test.
- No charset-parameter MIME test.
- Only 3 tests, a near-verbatim copy of ai-catalog-link.test.ts.

**Overlaps with:** `4.17`, `4.19`

## Evidence

### Signal: rfc9727-api-catalog — grade B (agent-action-surfaces)

**Mechanism:** Serving an RFC 9727 Linkset at /.well-known/api-catalog (media type application/linkset+json, profile https://www.rfc-editor.org/info/rfc9727) lets a client discover all of a publisher's APIs and their service-desc/service-doc documents from the domain alone.

**Evidence:** This is the only fully ratified, IANA-registered domain-level service-discovery mechanism available to a website today. RFC 9727 is IETF Standards Track (June 2025); both the `api-catalog` well-known suffix (registered 2024-12-23, status permanent) and the `api-catalog` link relation are in the IANA registries. The spec is normative: 'A supporting publisher SHALL resolve an HTTPS GET request to /.well-known/api-catalog and return an API catalog document', in Linkset format, SHOULD carrying the profile parameter. Real deployments verified live 2026-08-20: vercel.com returns a textbook-perfect response including `profile="https://www.rfc-editor.org/info/rfc9727"` with service-desc → openapi.vercel.sh, service-doc and status links; zapier.com returns application/linkset+json anchoring https://mcp.zapier.com/mcp with service-desc → its MCP server card — i.e. RFC 9727 is already being repurposed as an MCP discovery carrier, which makes it the most standards-defensible thing an agent-readiness audit can recommend.

**Counter-evidence:** Adoption is tiny and no AI agent is documented as consuming it. The May 2026 API Evangelist study fired 518 requests across 74 providers × 6 host candidates and found only FOUR valid Linksets (Cloudflare, Memesio, Merge.dev, Zuplo); Stripe and Twilio had none. Sixty-eight of the 74 returned HTTP 200 with an HTML body — the study's warning that 'an HTML 200 at a well-known path lies, which is worse than a 404' is the single most important validation rule for this entire audit domain. My own probe adds Vercel and Zapier as a fifth and sixth conformant publisher, so adoption is growing but still measured in single digits. Ratified standard + no known agent consumers = B, and informative rather than scored until a consumer is documented.
**Consumers:** none-known among AI agents; RFC-9727-aware API tooling · **Recommended tier:** informative

**Sources:** [RFC 9727 — api-catalog: A Well-Known URI and Link Relation to Help Discovery of APIs](https://www.rfc-editor.org/rfc/rfc9727.html) · [IANA Well-Known URIs registry](https://www.iana.org/assignments/well-known-uris/well-known-uris.xhtml) · [IANA Link Relation Types registry](https://www.iana.org/assignments/link-relations/link-relations-1.csv) · [Only Four API Providers Publish a Real .well-known/api-catalog Right Now](https://apievangelist.com/blog/2026/05/22/four-providers-publishing-well-known-api-catalog/) · [Live deployment: Vercel /.well-known/api-catalog (RFC 9727)](https://vercel.com/.well-known/api-catalog) · [Live deployment: Zapier /.well-known/api-catalog](https://zapier.com/.well-known/api-catalog)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

**Merged into:** `agent-interfaces/openapi-exists` (Plan 4, 2026-08-22) — [merged dossier](../../audits/agent-interfaces/openapi-exists.md)
