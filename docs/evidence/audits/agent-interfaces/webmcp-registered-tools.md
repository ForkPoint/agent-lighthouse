---
audit: agent-interfaces/webmcp-registered-tools
audit_id: "5.20"
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/webmcp-registered-tools.ts
slug: webmcp-registered-tools
review_verdict: delete
severity: high
evidence_grade: A
disposition: "proposed: redeem as experimental (pending triage)"
reviewed: 2026-08-21
---

# webmcp-manifest (`5.20`)

> agent-tools · source `webmcp-manifest.ts` · review verdict **delete** · evidence grade **A** · disposition: **proposed: redeem as experimental (pending triage)**

## What it checks

WebMCP is a proposed W3C standard (Chrome 146+) that lets websites expose structured tools to AI agents. A /.well-known/webmcp manifest is an emerging convention (not yet in the formal spec) that enables agentic crawlers to discover your site's capabilities before visiting, similar to how robots.txt works for search engines.

## Code review findings (2026-08-20, 11-agent pass)

Self-admittedly not a standard — the description says the file is 'an emerging convention (not yet in the formal spec)' — yet it is scored as a binary hard FAIL at high priority for effectively every website. Real WebMCP is a JavaScript API with no well-known file, so this cannot be satisfied by any site actually implementing WebMCP.

**Required fix:** Delete, along with the five dependent WebMCP audits. A static scanner cannot audit a JS-registration API; if the project wants WebMCP coverage it needs a headless-browser probe of `navigator.modelContext` after page load, which is a different capability entirely. Until then, publishing nothing here is the honest result.

**False-positive risks:**
- Universal false fail: no meaningful population of sites publishes /.well-known/webmcp, and a site that correctly implements real WebMCP (`navigator.modelContext.registerTool()`) still fails, because the real API leaves no static artifact for a non-JS scanner to find. The audit is unsatisfiable by correct implementations.
- `defaultPriority: 'high'` on an admittedly non-standard convention means it surfaces in top failures and recommendations ahead of genuinely actionable items.
- Even the pass path validates only `typeof t['name'] === 'string'` — no `description`, no `inputSchema`. A manifest of nameplates with no callable surface passes as 'WebMCP manifest found with N valid tool(s)'.
- SPA catch-all 200 HTML at /.well-known/webmcp → 'not valid JSON', a misleading diagnosis of a file that does not exist.
- Anchors five downstream audits (5.21-5.25) to the same fictional artifact, compounding the score damage.

**Test gaps:**
- No test acknowledging that a real WebMCP implementation (JS API, no file) exists and should not fail
- No inputSchema/description validation test
- No HTML-soft-404 fixture

**Overlaps with:** `5.21`, `5.22`, `5.23`, `5.24`, `5.25`

## Evidence

### Signal: webmcp-well-known-manifest — grade D (agent-action-surfaces)

**Mechanism:** Publishing a manifest at /.well-known/webmcp (or /.well-known/webmcp.json) listing a site's WebMCP tools lets an agent discover those tools before navigating to the page.

**Evidence:** The idea is intuitively appealing — WebMCP tools are only visible after page load, so a pre-navigation index would help — and two real deployments exist: zapier.com/.well-known/webmcp (verified 2026-08-20) and cloudflare.com's mcp.json points at a /.well-known/webmcp.json. So the practice is being invented in the wild.

**Counter-evidence:** There is no standard for it and every deployment is a different private schema. The WebMCP spec defines NO manifest format at all — tools are registered imperatively in JavaScript, and the declarative HTML-form path in §4.3 is marked 'entirely a TODO'. `webmcp` is not in the IANA Well-Known URIs registry. Zapier's document self-identifies as `"spec": "zapier-webmcp-discovery/1"` — a vendor-versioned format of one — and its own description concedes the tools 'are not HTTP endpoints', so the manifest cannot be acted on remotely; an agent must still navigate to the page. The freeCodeCamp author shipped exactly this manifest on citability.dev and recorded zero agent calls five days later. Auditing for an undefined file with no schema and no consumer would generate advice no one can act on correctly.
**Consumers:** none-known · **Recommended tier:** delete

**Sources:** [WebMCP — Draft Community Group Report](https://webmachinelearning.github.io/webmcp/) · [Live deployment: Zapier /.well-known/webmcp](https://zapier.com/.well-known/webmcp) · [Live deployment: Cloudflare /.well-known/mcp.json](https://cloudflare.com/.well-known/mcp.json) · [IANA Well-Known URIs registry](https://www.iana.org/assignments/well-known-uris/well-known-uris.xhtml) · [A Developer's Guide to WebMCP: Shipping a 0% Adoption Standard](https://www.freecodecamp.org/news/a-developers-guide-to-webmcp/)

### Signal: agent-surface-soft-404-validation — grade A (agent-action-surfaces)

**Mechanism:** A well-known or conventional agent-discovery path that returns HTTP 200 with an HTML body (an SPA catch-all rather than a real document) is worse than a 404, because a conforming client follows the standard, fails to parse, and has no recourse — so any audit must validate content-type and parseability, not status code.

**Evidence:** This is a meta-signal about how the other audits must be implemented, and it is the best-evidenced claim in the whole domain. The May 2026 API Evangelist study of 74 providers found that of the ~72 that did not serve a valid catalog, only TWO returned a clean 404 while SIXTY-EIGHT returned HTTP 200 with an HTML body, and concluded: 'an agent following the standard would get a 200, try to parse a LinkSet out of the body, fail, and have no useful recourse — an HTML 200 at a well-known path lies, which is worse than a 404.' My own probe on 2026-08-20 reproduced this independently across a different path set: linear.app returned 200 text/html for /openapi.json; github.com, linear.app, vercel.com and zapier.com returned 200 text/html for /mcp; zapier.com returned 200 text/html for /.well-known/ai-plugin.json. A status-code-only scanner would have reported all of these as adoption. Correct rule: require a JSON/YAML/linkset content-type, require the body to parse, and where a spec names a media type prefer it (application/ai-catalog+json for AI catalogs, application/linkset+json with the RFC 9727 profile for api-catalog, application/mcp-server-card+json for card entries) — Vercel demonstrates all of this is achievable in production.

**Counter-evidence:** None found — this is a validation-correctness requirement, not a contested adoption claim. The only nuance is that content negotiation is legitimate: RFC 9727 permits additional formats beyond the mandatory Linkset, so an audit should send an explicit Accept header before concluding a publisher is non-conformant, and should not penalise a clean 404 (which is honest) the way it penalises an HTML 200 (which is a lie).
**Consumers:** all clients following RFC 8615 well-known conventions · **Recommended tier:** scored

**Sources:** [Only Four API Providers Publish a Real .well-known/api-catalog Right Now](https://apievangelist.com/blog/2026/05/22/four-providers-publishing-well-known-api-catalog/) · [RFC 9727 — api-catalog: A Well-Known URI and Link Relation to Help Discovery of APIs](https://www.rfc-editor.org/rfc/rfc9727.html) · [experimental-ext-server-card — docs/discovery.md](https://raw.githubusercontent.com/modelcontextprotocol/experimental-ext-server-card/main/docs/discovery.md) · [Live deployment: Vercel /.well-known/api-catalog (RFC 9727)](https://vercel.com/.well-known/api-catalog) · [Live deployment: Vercel /.well-known/ai-catalog.json](https://vercel.com/.well-known/ai-catalog.json) · [Live deployment: Zapier /.well-known/api-catalog](https://zapier.com/.well-known/api-catalog)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
