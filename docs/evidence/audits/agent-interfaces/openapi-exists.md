---
audit: agent-interfaces/openapi-exists
audit_id: "5.1, 4.18"
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/openapi-exists.ts
slug: openapi-exists
review_verdict: fix
severity: high
evidence_grade: B
disposition: "merged 2026-08-22 (Plan 4, Task 7) — absorbs openapi-link (4.18); 4.18's redeem resolves here"
reviewed: 2026-08-22
---

# openapi-exists (`5.1`, `4.18`)

> agent-interfaces · source `openapi-exists.ts` · merged API-discovery audit, absorbs openapi-link (4.18) · evidence grade **B** · tier **informative** (weight 0)

## What it checks

One discovery audit over the API-description mechanisms that actually exist, strongest first.

| State | Result |
| :--- | :--- |
| an RFC 9727 linkset at `/.well-known/api-catalog` — served as data, parseable, with a non-empty `linkset` array | `pass` |
| a valid OpenAPI document at `/openapi.json` or `/openapi.yaml` (version key **and** a `paths` object, non-HTML content type) | `pass` |
| a `<link rel="service-desc">` (or a spec-shaped `alternate`) on any crawled page, followed and verified | `pass` |
| `/openapi.json` served but not an OpenAPI document; or a `<link>` advertising a spec that does not resolve to one; or the scan was blocked by a WAF | `warn`, priority `medium` |
| none of the above — no API surface at all | `na` |

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

**Overlaps with:** `5.2`, `5.3`, `5.4`, `5.5`, `5.6`, `5.26`, `4.18` (now absorbed here)

## The merge and 4.18's redemption (Plan 4, Task 7, 2026-08-22)

4.18 carried a `TODO(redeem)` whose instruction was to resolve *as this merge*: **"one discovery audit for real mechanisms incl. RFC 9727 api-catalog (graded B), drop link-tag requirement that fails every site."** Both halves land here.

**The link-tag requirement is dropped.** 4.18 failed a site unless it happened to carry `<link rel="alternate" type="application/json">` whose *English, optional, human-authored* `title` attribute contained the string "openapi" — on `ctx.pages[0]` only, which is the marketing homepage and not the `/docs` or `/developers` page where such a link actually lives. A site with a perfectly published spec failed, and was told that "agentic workflows that could call your API services" were blocked. The head link is now a *hint to follow*: `rel="service-desc"` (RFC 8631, the standards-track relation) is accepted on its own, `alternate` is accepted when the href looks like a spec or the media type is the registered `application/vnd.oai.openapi*`, media types are compared after stripping parameters so `application/json; charset=utf-8` matches, YAML types are accepted, `title` is never consulted, and every crawled page is searched. When a link is found the advertised URL is fetched and validated — so the link earns a pass by producing a spec, not by existing.

**RFC 9727 becomes the first thing checked**, and `/.well-known/api-catalog` is added to the orchestrator's root-file probe. It is the only ratified, IANA-registered domain-level API discovery mechanism a website can serve, and it is checked the way its own evidence demands: served as data, parseable, with a non-empty `linkset` array. The API Evangelist survey's central finding is enforced here — 68 of 74 providers answer that path with an HTML 200, and *"an HTML 200 at a well-known path lies, which is worse than a 404"*. A `text/html` body at any probed path is now rejected outright, which also kills 5.1's own worst false positive: the `/openapi.yaml` branch used to pass on `body.includes('openapi:')`, so any Swagger-UI shell or docs page mentioning the string passed as a spec.

**Three more of 5.1's required fixes come with it**, because a discovery audit that lies about what it found is not a discovery audit:

- **A brochure site is `na`, not a scored failure** (fix #1). Roughly every site without an API used to take a `high`-priority `fail` on the heaviest category. There is nothing for them to fix.
- **The document is validated, not merely parsed** (fix #2). `isObject(parsed)` accepted `{"hello":1}` at `/openapi.json` as a "Valid OpenAPI JSON spec"; a version key (`openapi` 3.x or `swagger` 2.0) plus a `paths` object is now required, and a 200 that is not a spec warns rather than passing or vanishing.
- **A blocked scan is not evidence of absence** (fix #5). `ctx.wafProtection.isBlocked` now yields "could not verify (blocked by …)" instead of "not found".

### Absorbed evidence — openapi-link (4.18)

4.18's dossier is kept verbatim at [merged/agent-interfaces/openapi-link.md](../../merged/agent-interfaces/openapi-link.md) (grade **B**). Its graded signal is not the link tag at all — it is `rfc9727-api-catalog`: IETF Standards Track since June 2025, with both the `api-catalog` well-known suffix (registered 2024-12-23, permanent) and the `api-catalog` link relation in the IANA registries, normative language ("a supporting publisher SHALL resolve an HTTPS GET request to /.well-known/api-catalog"), and live conformant deployments verified on vercel.com and zapier.com — the latter using the linkset to anchor an MCP server card, which is the clearest sign the mechanism is being adopted forward rather than fading.

Its counter-evidence is equally clear: adoption is in single digits (four valid linksets across 74 providers in the May 2026 survey, plus the two verified here), and no AI agent is documented consuming it.

### Grade decision: **C → B**, tier stays `informative`, weight 0

The grade rises because the merged audit now *implements* a materially stronger mechanism than the one it was graded on. 5.1's **C** was pinned by its own discovery leg being pure convention: OpenAPI 3.1 defines no discovery path, only that it is "RECOMMENDED that the root OpenAPI document be named `openapi.json` or `openapi.yaml`", and every documented consumer (GPT Actions, Microsoft 365 Copilot API plugins) is handed the document by a developer. RFC 9727 is a ratified standard with IANA registration and verified production deployments — 4.18's **B** — and it is checked first, so B is the strongest path the audit actually exercises.

Tier does **not** follow the grade. 4.18's evidence names its own tier: *"Ratified standard + no known agent consumers = B, and informative rather than scored until a consumer is documented"*, with `Recommended tier: informative`. 4.18 shipped at `tier: scored` (weight 0.6) against that recommendation, on a proposal explicitly marked *pending triage approval*; the merged audit corrects that rather than inheriting it. `tier: informative` and `weightForGrade('B', 'informative')` = **0**, exactly what 4.18's own recorded recommendation asks for. Net effect on scoring: one 0.6-weight audit leaves the scored set, and no site is scored on a mechanism no agent is documented to read.

`scoreDisplayMode` stays `informative` (the ledger law requires it for a non-`scored` tier). `defaultPriority` drops from `high` to `medium`.

### Deviations

- **Extra probe paths were not added** (5.1 fix #4, partially). `/api/openapi.json`, `/v1/openapi.json`, `/swagger.json` and `/api-docs` are still not fetched speculatively; the `<link rel="service-desc">` follow covers the same ground without adding four more requests per scan to every site. The `Link:` *response header* is likewise not read — `FetchResult.headers` carries it, but no page-level gatherer parses link headers yet, and adding one belongs with that gatherer.
- **YAML is still not parsed with a YAML parser** (5.1 fix #3, partially). The check is now anchored (`^openapi:`/`^swagger:` plus `^paths:`) and gated on a non-HTML content type, which is what actually killed the soft-404 false positive; pulling in a YAML dependency to go further was not worth it for a weight-0 audit.
- **Only the first advertised `<link>` is followed.** A page declaring several spec links gets one fetch, not one per link.
- **`/.well-known/api-catalog` adds one root-file request per scan.** That is the cost of checking the ratified mechanism at all.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._


## Re-checked (evidence sweep, 2026-08-24)

**No change: B / informative / weight 0. The recorded reasoning still holds; one
supporting sentence is withdrawn.**

The sweep asked whether any client has documented consuming
`/.well-known/api-catalog` since this dossier was written. **No.** RFC 9727 is
still Standards Track, the well-known suffix and the `api-catalog` link relation
are both still IANA-registered, and every reference found is either the RFC's own
normative text, a publisher-side generator (Fern generates the endpoint and
advertises it via a `Link` header on every docs page), or conditional trade
commentary. The May 2026 API Evangelist survey — 74 providers, 518 parallel
requests across six subdomain prefixes — found four valid linksets and named no
deployed client. The condition this audit's tier waits on, *"informative rather
than scored until a consumer is documented"*, has not been met.

### Withdrawn: the trajectory claim

This dossier reads Zapier's MCP-card linkset as *"the clearest sign the mechanism
is being adopted forward rather than fading."* As of 2026-06-17 the opposite
reading is better supported.

Google, Microsoft, Hugging Face and eight further companies published the
**Agentic Resource Discovery** specification — a draft (v0.9) for exactly the
problem RFC 9727 addresses, agents finding tools, APIs and agents on a domain —
at a **different** well-known path, `/.well-known/ai-catalog.json`. The ARD
specification does not mention RFC 9727 or `/.well-known/api-catalog` anywhere,
and neither does Google's announcement.

And ARD has the thing api-catalog still lacks: a first-party consumer client.
Hugging Face ships `huggingface/hf-discover`, whose navigate mode performs
*"automatic `.well-known/ai-catalog.json` discovery from a website"* and follows
federated registries.

So the ratified standard has publishers and no documented consumer, while the
younger unratified consortium spec has a documented one. The grade and tier here
do not move — B prices the ratified standard, informative prices the absent
consumer, and both readings are unchanged — but the sentence claiming forward
momentum is withdrawn, and this audit is flagged for re-review if ARD adoption
continues. See `agent-interfaces/ai-catalog-exists`, which already scores the
ARD path.

**Sources:** [RFC 9727](https://www.rfc-editor.org/rfc/rfc9727.html) · [IANA Well-Known URIs](https://www.iana.org/assignments/well-known-uris/well-known-uris.xhtml) · [ARD specification](https://github.com/ards-project/ard-spec) · [huggingface/hf-discover](https://github.com/huggingface/hf-discover) · [Four providers publishing /.well-known/api-catalog (API Evangelist, 2026-05-22)](https://apievangelist.com/blog/2026/05/22/four-providers-publishing-well-known-api-catalog/) · [Fern api-catalog](https://buildwithfern.com/learn/docs/ai-features/api-catalog)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-21 — evidence graded (see below).
- 2026-08-21 — approved: 4.18 merges away into 5.1, resolving its TODO(redeem) (v2 audit map).
- 2026-08-22 — merged (Plan 4, Task 7); grade C → B, tier stays informative; registry 159 → 158 for this fold.

## Evidence (2026-08-21)

**Mechanism claim:** An AI agent given only a site's origin fetches `/openapi.json` or `/openapi.yaml`, and converts the operations it finds into callable tools, without a developer having registered the document with the agent first.

**Grade: C** — OpenAPI is unambiguously the format documented consumers ingest, but every documented consumer receives the document from a developer at build time; no vendor documents a named agent that discovers a spec by probing a site root, so the discovery leg this audit actually measures is convention, not proven behavior.

**Evidence:**
- OpenAPI 3.1 defines no discovery path or well-known URI; it only states "It is RECOMMENDED that the root OpenAPI document be named: `openapi.json` or `openapi.yaml`", which is the sole basis for probing those two paths — https://spec.openapis.org/oas/v3.1.0.html (verified 2026-08-21)
- OpenAI GPT Actions are built by pasting the OpenAPI schema into the Action editor, not by ChatGPT retrieving it from the site: "ChatGPT uses those names and descriptions to understand (a) which API action should be called and (b) which parameter should be used" — https://developers.openai.com/api/docs/actions/getting-started (verified 2026-08-21)
- Microsoft 365 Copilot plugins "interact with … REST APIs that have an OpenAPI description", supplied inside a plugin manifest that the developer packages and publishes — https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/overview-api-plugins (verified 2026-08-21)
- The standards-track machine-discovery path for APIs is `/.well-known/api-catalog` (RFC 9727, June 2025), a linkset that may point at OpenAPI documents — not `/openapi.json`; no AI-agent consumer of it is documented — https://www.rfc-editor.org/rfc/rfc9727.html (verified 2026-08-21)

**Counter-evidence:** No crawler or agent documentation from OpenAI, Anthropic, Google, Microsoft, or Perplexity states that any named agent fetches `/openapi.json` from a site root. The plugin-era discovery chain (`/.well-known/ai-plugin.json` pointing at a spec URL) is gone from OpenAI's current documentation, which describes pasting a schema instead. For remote tool surfaces, the documented discovery paths in 2026 are MCP's `server/discover` and the DNS-verified MCP Registry, not a root OpenAPI file. Passing this audit therefore proves an artifact exists, not that any agent will find it.
- 2026-08-24 — evidence sweep: re-checked, no change. B / informative / weight 0 stands; the "adopted forward rather than fading" sentence is withdrawn on ARD counter-evidence.
