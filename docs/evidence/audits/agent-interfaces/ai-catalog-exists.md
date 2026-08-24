---
audit: agent-interfaces/ai-catalog-exists
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/ai-catalog-exists.ts
slug: ai-catalog-exists
evidence_grade: C
disposition: "merged 2026-08-22 (Plan 4, Task 7) — absorbs ai-catalog-link (4.19); rewritten to ARD §4.1 2026-08-22 (Plan 4, Task 10)"
reviewed: 2026-08-22
recommended_tier: informative
consumers:
  - none-known (no shipping MCP client documents fetching this path)
signals:
  - name: mcp-discovery-ai-catalog-well-known
    grade: C
    domain: agent-action-surfaces
sources:
  - mcp-sep-2127
  - mcp-ext-server-card-discovery
  - ai-catalog-repo
  - iana-well-known-uris
  - mcp-spec-versioning
  - anthropic-claude-custom-connectors
  - openai-apps-sdk-deploy
  - probe-vercel-ai-catalog
  - probe-zapier-ai-catalog
---

# ai-catalog-exists (`5.7`, `4.19`)

> agent-interfaces · source `ai-catalog-exists.ts` · absorbs ai-catalog-link (4.19) · evidence grade **A** · tier **scored** (weight 1.0) · rewritten to the real ARD schema — see below

## What it checks

The AI catalog is the central discovery file that tells AI agents what capabilities your site offers. Think of it as a table of contents for your APIs, tools, and services. Without it, agents must probe multiple endpoints to understand what your site can do.

## Code review findings (2026-08-20, 11-agent pass)

Invented standard. `/.well-known/ai-catalog.json` is not registered with IANA, is not published by any working group, and is consumed by no crawler or agent. The audit hard-fails effectively every website on the internet at medium priority and tells owners to author a file with a schema this framework made up.

**Required fix:** Delete this audit and its two dependents (5.8, 5.9). If discovery coverage is wanted, spend the weight on real signals: a linked OpenAPI spec, an MCP endpoint, or a well-formed llms.txt.

**False-positive risks:**
- 100% false-fail rate on real sites: no site outside this framework's own scaffolding publishes this file, so the audit is a constant zero that carries no information about the site.
- Even when present, `Array.isArray(parsed['services'])` is the only validation — `{"services": []}` passes as 'AI catalog found with 0 service(s)', a vacuous pass.
- A SPA catch-all returning 200 text/html means JSON.parse fails and the user is told 'ai-catalog.json is not valid JSON' when in fact there is no such file — a confusing, wrong diagnosis.
- WAF 403 on /.well-known/* reads as 'not found'; `ctx.wafProtection` unused.

**Test gaps:**
- No test that an empty services array is a vacuous pass
- No HTML-soft-404 fixture
- No content-type assertion

**Overlaps with:** `5.8`, `5.9`, `5.10`, `4.19` (now absorbed here)

## The merge (Plan 4, Task 7, 2026-08-22)

**Scope note first: this was the fold only.** 5.7's own required rework — the pass condition becoming ARD §4.1's `specVersion` + `host` + `entries[]` instead of a `services` array, and the guidance/code samples being replaced with the real schema — was not done here. It landed in Task 10, recorded in the next section. Everything below concerns 4.19's advertisement check and nothing else.

**What was folded.** 4.19 checked for a `<link rel="alternate" type="application/json">` whose optional, English, human-authored `title` attribute contained the exact two-word phrase "ai catalog" — on `ctx.pages[0]` only, with exact case-sensitive `rel` and `type` comparisons that also rejected `application/json; charset=utf-8`. No site on the public web emits that shape, so the audit returned a scored `fail` on every real scan and measured nothing. Its own required rework names the real token: **match `rel="ai-catalog"` (any type), accept the equivalent HTTP `Link` header, and downgrade it to a nice-to-have relative to the well-known file.** All three land:

- `ai-catalog` is matched as a `rel` *token* — case-insensitive, at any position in a multi-token `rel`, with no constraint on `type` and no reference to `title`.
- An RFC 8288 `Link: </ai-catalog.json>; rel="ai-catalog"` response header counts the same way.
- Every crawled page is searched, not just the homepage.

**It is deliberately not a pass path.** The one documented consumer, Hugging Face's `hf-discover`, resolves `https://{domain}/.well-known/ai-catalog.json` and nothing else, so an advertisement without the well-known file is not a working catalog. It therefore converts the three `fail` states into a `warn`: *a catalog is advertised at X, but the documented consumer only resolves the well-known path*. When the well-known file is valid, the advertisement is reported in the pass detail as the nice-to-have it is.

### Absorbed evidence — ai-catalog-link (4.19)

4.19's dossier is kept verbatim at [merged/agent-interfaces/ai-catalog-link.md](../../merged/agent-interfaces/ai-catalog-link.md) (grade **B**). The grade comes from its adversarial redemption research: the `rel="ai-catalog"` mechanism is written into two draft specs (ARD §6.1 and the Linux Foundation Agent Card WG consuming guide) and is genuinely deployed in production with the exact token, verified by live fetch of neon.com and specification.website. That is what justifies keeping an advertisement check at all — and the same research is what caps it: the consuming side resolves the well-known path, so the link is a hint, not a location an agent will follow.

### Grade decision: stays **A**, tier `scored`, weight 1.0

5.7 grades **A** — a named vendor tool (`hf-discover`) documents and implements fetching exactly `https://{domain}/.well-known/ai-catalog.json`, the path is normative in the ARD draft co-authored by Google, Microsoft and Hugging Face, and there is verifiable production adoption (Neon, Weaviate, Shopware core, specification.website). 4.19 grades **B** on the advertisement half. The strongest proven path is unchanged, and the absorbed evidence is weaker, so the grade does not move: **A**, `tier: scored`, `weight 1.0`.

`scoreDisplayMode` moves from `binary` to `ternary` for the new middle state. `defaultPriority` stays `medium`.

### Deviations

- **The advertised href is never fetched.** Following it would be the natural next step, but the audit's own evidence says no consumer does, so spending a request on it would model behaviour nothing exhibits.
- **`type="application/ai-catalog+json"` is preferred in the guidance but not required in the match**, exactly as 4.19's rework specifies ("any type, ideally application/ai-catalog+json").

## The ARD rewrite (Plan 4, Task 10, 2026-08-22)

The required rework from the [redemption dossier](../../deletions/agent-tools/ai-catalog-exists.md) is executed. That dossier's fatal finding was that the audit passed only on a top-level `services` array, a shape that occurs in no revision of the ARD spec and in none of the four live manifests checked (ARD conformance example, neon.com, weaviate.io, the Shopware core Twig template) — so a spec-perfect site failed at medium priority and was handed an invented schema to implement.

**Old pass condition:** `/.well-known/ai-catalog.json` returns 200 and `Array.isArray(parsed.services)`. `{"services": []}` passed as "AI catalog found with 0 service(s)".

**New pass condition:** the file returns 200 with a JSON body carrying all three fields ARD §4.1 makes mandatory — a non-empty `specVersion` string, a `host` object and an `entries` array — and `entries` is non-empty.

Parsing now lives in the shared `_ard.ts` module (see the ai-catalog-urls and ai-catalog-metadata dossiers), so the three catalog audits cannot drift apart on what an ARD manifest is.

Four of the false-positive risks listed above are closed by the same change:

- **The vacuous pass is gone.** A conformant manifest with `entries: []` is spec-legal but advertises nothing to an agent, so it is a `warn` — the middle state the `ternary` display mode already carries — not a pass.
- **The HTML soft-404 is diagnosed correctly.** A 200 `text/html` body (or a body starting with `<!doctype`/`<html>`) now reports "returns HTML, not a manifest — the request is being answered by a catch-all route" instead of "ai-catalog.json is not valid JSON".
- **A malformed manifest names its missing fields.** The failure message lists exactly which of `specVersion`/`host`/`entries` is absent, so a site publishing the old invented schema is told what to change.
- **The advertisement no longer misdiagnoses a served-but-broken manifest.** The `rel="ai-catalog"` warn ("advertised at X, but the documented consumer resolves only the well-known path") now fires only for *absence* — a 404 or an HTML soft-404. When a manifest is served and merely malformed, the result is a plain `fail` naming the shape problem, with the advertisement reported as context.

**Guidance and code sample** are the spec's own schema: `specVersion`, `host{displayName, identifier, documentationUrl}` and `entries[]` with `identifier` (a domain-anchored URN), `displayName`, `type` (an IANA media type), `url`, `description`, `capabilities` and `representativeQueries`. `docsUrl` points at the ARD spec. The `rel="ai-catalog"` line stays appended as the nice-to-have it is.

### Grade decision: stays **A**, tier `scored`, weight 1.0

Source: the [redemption dossier's verdict](../../deletions/agent-tools/ai-catalog-exists.md) — "redeemed — keep with rewrite (grade A)" — and the [REWORK-TODO entry](../../../../packages/core/src/audits/REWORK-TODO.md) that carries it. The grade rests on a named vendor tool (Hugging Face `hf-discover`) that resolves exactly `https://{domain}/.well-known/ai-catalog.json` and reads `entries[]`, the path being normative in the ARD draft co-authored by Google, Microsoft and Hugging Face, and verifiable production adoption (Neon, Weaviate, Shopware core, specification.website).

Task 7 recorded that the A/`scored`/1.0 meta was only defensible once this rewrite landed, because the audit as written could not pass on a conformant site. It now checks the shape those consumers actually read, so the grade stands as researched. Per the §4 weight law `weightForGrade('A', 'scored') = 1.0`; `scoreDisplayMode` stays `ternary`; `defaultPriority` stays `medium`.

### Rewrite deviations

- **`application/ai-catalog+json` is not required to pass.** §3.3 calls the media type a "de-facto community standard tracking towards formal registration" and it is unregistered with IANA, so requiring it would fail conformant publishers who serve `application/json`. It is recommended in the guidance and reported, not gated.
- **`ctx.wafProtection` is still unused.** A WAF 403 on `/.well-known/*` continues to read as absence. Distinguishing the two is a cross-audit concern (every well-known-file audit has it) and is out of scope for a pass-condition rewrite.

## Evidence

### Signal: mcp-discovery-ai-catalog-well-known — grade C (agent-action-surfaces)

**Mechanism:** Publishing a JSON document at https://{site}/.well-known/ai-catalog.json that lists MCP Server Card entries (type application/mcp-server-card+json) causes MCP clients performing domain-level discovery to find and connect to the site's MCP server without manual URL entry.

**Evidence:** This is the path the MCP project itself is converging on. SEP-2127 (opened 2026-01-21, label 'in-review', still OPEN and unmerged as of 2026-08-11) delegates domain-level discovery to an 'AI Catalog' and its extension repo's docs/discovery.md states: 'An AI Catalog MAY be served from any URL. For automated domain-level discovery, hosts MAY publish one at: /.well-known/ai-catalog.json. Clients performing domain-level discovery SHOULD attempt to retrieve this well-known URL.' Media type SHOULD be application/ai-catalog+json; MCP entries use type application/mcp-server-card+json and urn:air: identifiers. Real conformant deployments exist and I verified them live on 2026-08-20: vercel.com serves it with the exact application/ai-catalog+json media type and specVersion 1.0; zapier.com serves specVersion 1.0 with a trustManifest and an entry pointing at its MCP server card. The underlying AI Catalog repo (Agent-Card/ai-catalog, 210 stars) was pushed the same day I checked, so the work is live. Audit guidance: check /.well-known/ai-catalog.json, validate specVersion + entries[].type + entries[].url, require a JSON content-type (reject HTML 200 soft-404s), and prefer application/ai-catalog+json.

**Counter-evidence:** The SEP is NOT merged — nothing about this is in the ratified spec (current revision 2026-07-28). `ai-catalog.json` is NOT in the IANA Well-Known URIs registry (152 entries checked; mcp, mcp.json, ai-catalog.json, webmcp, openapi are all absent). The MCP extension repo carrying the discovery text has 5 stars. No MCP client vendor documents consuming it: Anthropic's own docs say 'You can manually add any third-party connector to Claude as long as you have the URL of that remote MCP server' and OpenAI's Apps SDK routes through developer-mode URL paste plus 'public plugin submission' with 'domain verification'. My probe of 19 major domains found only 2 publishers (Vercel, Zapier). SEP-2127 itself lists 'No Domain-Level Discovery' as an *unsolved* pain point, which is an admission that the mechanism does not yet work.

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/agent-tools/ai-catalog-exists.md](../../deletions/agent-tools/ai-catalog-exists.md). Outcome: **redeemable**, grade A.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (grade A, rewrite required).
- 2026-08-21 — approved: 4.19 merges away into 5.7 (v2 audit map).
- 2026-08-22 — merged (Plan 4, Task 7): 4.19 folded in, grade and tier unchanged; registry 158 → 157 for this fold. The ARD §4.1 rewrite remained open for Task 10.
- 2026-08-22 — rewritten (Plan 4, Task 10): pass condition is ARD §4.1 (`specVersion` + `host` + non-empty `entries[]`), guidance and code sample replaced with the real schema, parsing extracted to `_ard.ts`. Grade **A**, tier `scored`, weight 1.0 — unchanged, and now defensible on a conformant site. `TODO(redeem)` header removed; entry dropped from REWORK-TODO.md.
