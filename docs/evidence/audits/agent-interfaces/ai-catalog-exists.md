---
audit: agent-interfaces/ai-catalog-exists
audit_id: "5.7, 4.19"
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/ai-catalog-exists.ts
slug: ai-catalog-exists
review_verdict: delete
severity: high
evidence_grade: A
disposition: "merged 2026-08-22 (Plan 4, Task 7) — absorbs ai-catalog-link (4.19); ARD rewrite still open (Task 10)"
reviewed: 2026-08-22
---

# ai-catalog-exists (`5.7`, `4.19`)

> agent-interfaces · source `ai-catalog-exists.ts` · absorbs ai-catalog-link (4.19) · evidence grade **A** · tier **scored** (weight 1.0) · **rewrite still required** — see below

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

**Scope note first: this is the fold only.** 5.7's own required rework — the pass condition becoming ARD §4.1's `specVersion` + `host` + `entries[]` instead of a `services` array, and the guidance/code samples being replaced with the real schema — is **not** done here. It is Task 10's job, and the `TODO(redeem)` header stays on the source file with a note saying so. Everything below concerns 4.19's advertisement check and nothing else; the `services`-array pass condition, the vacuous `{"services": []}` pass, the HTML-soft-404 misdiagnosis and the unused `ctx.wafProtection` are all still open against 5.7.

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

- **The ARD rewrite is out of scope** — see the scope note above. This fold does not touch the pass condition, and the code sample still shows the invented `services` schema (with the `rel="ai-catalog"` line appended). Task 10 replaces both.
- **The advertised href is never fetched.** Following it would be the natural next step, but the audit's own evidence says no consumer does, so spending a request on it would model behaviour nothing exhibits.
- **`type="application/ai-catalog+json"` is preferred in the guidance but not required in the match**, exactly as 4.19's rework specifies ("any type, ideally application/ai-catalog+json").

## Evidence

### Signal: mcp-discovery-ai-catalog-well-known — grade C (agent-action-surfaces)

**Mechanism:** Publishing a JSON document at https://{site}/.well-known/ai-catalog.json that lists MCP Server Card entries (type application/mcp-server-card+json) causes MCP clients performing domain-level discovery to find and connect to the site's MCP server without manual URL entry.

**Evidence:** This is the path the MCP project itself is converging on. SEP-2127 (opened 2026-01-21, label 'in-review', still OPEN and unmerged as of 2026-08-11) delegates domain-level discovery to an 'AI Catalog' and its extension repo's docs/discovery.md states: 'An AI Catalog MAY be served from any URL. For automated domain-level discovery, hosts MAY publish one at: /.well-known/ai-catalog.json. Clients performing domain-level discovery SHOULD attempt to retrieve this well-known URL.' Media type SHOULD be application/ai-catalog+json; MCP entries use type application/mcp-server-card+json and urn:air: identifiers. Real conformant deployments exist and I verified them live on 2026-08-20: vercel.com serves it with the exact application/ai-catalog+json media type and specVersion 1.0; zapier.com serves specVersion 1.0 with a trustManifest and an entry pointing at its MCP server card. The underlying AI Catalog repo (Agent-Card/ai-catalog, 210 stars) was pushed the same day I checked, so the work is live. Audit guidance: check /.well-known/ai-catalog.json, validate specVersion + entries[].type + entries[].url, require a JSON content-type (reject HTML 200 soft-404s), and prefer application/ai-catalog+json.

**Counter-evidence:** The SEP is NOT merged — nothing about this is in the ratified spec (current revision 2026-07-28). `ai-catalog.json` is NOT in the IANA Well-Known URIs registry (152 entries checked; mcp, mcp.json, ai-catalog.json, webmcp, openapi are all absent). The MCP extension repo carrying the discovery text has 5 stars. No MCP client vendor documents consuming it: Anthropic's own docs say 'You can manually add any third-party connector to Claude as long as you have the URL of that remote MCP server' and OpenAI's Apps SDK routes through developer-mode URL paste plus 'public plugin submission' with 'domain verification'. My probe of 19 major domains found only 2 publishers (Vercel, Zapier). SEP-2127 itself lists 'No Domain-Level Discovery' as an *unsolved* pain point, which is an admission that the mechanism does not yet work.
**Consumers:** none-known (no shipping MCP client documents fetching this path) · **Recommended tier:** informative

**Sources:** [SEP-2127: MCP Server Cards — HTTP Server Discovery (pull request)](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2127) · [experimental-ext-server-card — docs/discovery.md](https://raw.githubusercontent.com/modelcontextprotocol/experimental-ext-server-card/main/docs/discovery.md) · [Agent-Card/ai-catalog — working repository for common AI Card standard](https://github.com/Agent-Card/ai-catalog) · [IANA Well-Known URIs registry](https://www.iana.org/assignments/well-known-uris/well-known-uris.xhtml) · [Model Context Protocol — Versioning (current revision 2026-07-28)](https://modelcontextprotocol.io/specification/versioning) · [Third party connectors with remote MCP — Claude Docs](https://claude.com/docs/connectors/custom/remote-mcp) · [OpenAI Apps SDK — Deploy](https://developers.openai.com/apps-sdk/deploy/) · [Live deployment: Vercel /.well-known/ai-catalog.json](https://vercel.com/.well-known/ai-catalog.json) · [Live deployment: Zapier /.well-known/ai-catalog.json](https://zapier.com/.well-known/ai-catalog.json)

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/agent-tools/ai-catalog-exists.md](../../deletions/agent-tools/ai-catalog-exists.md). Outcome: **redeemable**, grade A.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (grade A, rewrite required).
- 2026-08-21 — approved: 4.19 merges away into 5.7 (v2 audit map).
- 2026-08-22 — merged (Plan 4, Task 7): 4.19 folded in, grade and tier unchanged; registry 158 → 157 for this fold. The ARD §4.1 rewrite remains open for Task 10.
