---
audit: agent-interfaces/webmcp-registered-tools
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/webmcp-registered-tools.ts
slug: webmcp-registered-tools
evidence_grade: B
disposition: "kept — manifest check replaced by runtime registered-tools detection 2026-08-22 (Plan 4, Task 16)"
reviewed: 2026-08-22
recommended_tier: scored
tier_rationale: "Recommended scored before the Plan 4 rewrite. Ships experimental: WebMCP is an origin-trial feature, and the rewrite left one signal whose consumer is still behind that trial (contradiction sweep Task 10, 2026-08-24)."
consumers:
  - all clients following RFC 8615 well-known conventions
signals:
  - name: webmcp-well-known-manifest
    grade: D
    domain: agent-action-surfaces
  - name: agent-surface-soft-404-validation
    grade: A
    domain: agent-action-surfaces
sources:
  - iana-well-known-uris
  - webmcp-spec-no-nav
  - probe-zapier-webmcp-manifest
  - probe-cloudflare-mcp-json
  - freecodecamp-webmcp-zero-adoption
  - apievangelist-api-catalog-adoption
  - rfc-9727
  - mcp-ext-server-card-discovery
  - probe-vercel-api-catalog
  - probe-vercel-ai-catalog
  - probe-zapier-api-catalog
---

# webmcp-registered-tools (`5.20`)

> agent-interfaces · source `webmcp-registered-tools.ts` · evidence grade **B** · tier **experimental** (weight 0) · rewritten from an invented `/.well-known/webmcp` manifest check to runtime `navigator.modelContext` detection — see below

## What it checks

WebMCP lets a page register agent-callable tools at runtime through `navigator.modelContext`, which is what Chrome exposes to an in-browser agent and what Google Lighthouse reports as "Registered WebMCP tools". This scanner has no JavaScript runtime, so it reports the registrations visible in the served document and treats silence as unknown rather than as absence.

A tool name found in an inline `navigator.modelContext` registration passes. A reference to `navigator.modelContext` with no readable tool name warns. No registration in the served document is not applicable, because a tool registered from an external script is invisible here. The audit never fails.

The audit does not read a `/.well-known/webmcp` manifest. The WebMCP specification defines no manifest, so an earlier version's demand for one was dropped. The grade-D evidence below is the record of why.

## Evidence

### Signal: webmcp-well-known-manifest — grade D (agent-action-surfaces)

**Mechanism:** Publishing a manifest at /.well-known/webmcp (or /.well-known/webmcp.json) listing a site's WebMCP tools lets an agent discover those tools before navigating to the page.

**Evidence:** The idea is intuitively appealing — WebMCP tools are only visible after page load, so a pre-navigation index would help — and two real deployments exist: zapier.com/.well-known/webmcp (verified 2026-08-20) and cloudflare.com's mcp.json points at a /.well-known/webmcp.json. So the practice is being invented in the wild.

**Counter-evidence:** There is no standard for it and every deployment is a different private schema. The WebMCP spec defines no manifest format at all — tools are registered imperatively in JavaScript, and the declarative HTML-form path in §4.3 is marked 'entirely a TODO'. `webmcp` is not in the IANA Well-Known URIs registry. Zapier's document self-identifies as `"spec": "zapier-webmcp-discovery/1"` — a vendor-versioned format of one — and its own description concedes the tools 'are not HTTP endpoints', so the manifest cannot be acted on remotely; an agent must still navigate to the page. The freeCodeCamp author shipped exactly this manifest on citability.dev and recorded zero agent calls five days later. Auditing for an undefined file with no schema and no consumer would generate advice no one can act on correctly.

### Signal: agent-surface-soft-404-validation — grade A (agent-action-surfaces)

**Mechanism:** A well-known or conventional agent-discovery path that returns HTTP 200 with an HTML body is worse than a 404 — that body is an SPA catch-all rather than a real document. A conforming client follows the standard, fails to parse, and has no recourse. Any audit must therefore validate content-type and parseability, not status code.

**Evidence:** This is a meta-signal about how the other audits must be implemented, and it is the best-evidenced claim in the whole domain. The May 2026 API Evangelist study covered 74 providers. Of the roughly 72 that served no valid catalog, only two returned a clean 404; sixty-eight returned HTTP 200 with an HTML body. The study concluded: 'an agent following the standard would get a 200, try to parse a LinkSet out of the body, fail, and have no useful recourse — an HTML 200 at a well-known path lies, which is worse than a 404.' A probe on 2026-08-20 reproduced that result across a different path set. linear.app returned 200 text/html for /openapi.json; github.com, linear.app, vercel.com and zapier.com returned 200 text/html for /mcp; zapier.com returned 200 text/html for /.well-known/ai-plugin.json. A status-code-only scanner would have reported all of these as adoption. The correct rule is to require a JSON, YAML or linkset content-type, and to require the body to parse. Where a spec names a media type, prefer it: application/ai-catalog+json for AI catalogs, application/linkset+json with the RFC 9727 profile for api-catalog, and application/mcp-server-card+json for card entries. Vercel demonstrates that all of this is achievable in production.

**Counter-evidence:** None found — this is a validation-correctness requirement, not a contested adoption claim. The only nuance is that content negotiation is legitimate. RFC 9727 permits additional formats beyond the mandatory Linkset, so an audit should send an explicit Accept header before concluding a publisher is non-conformant. It should also not penalise a clean 404, which is honest, the way it penalises an HTML 200, which is a lie.

## Implementation deviations

- The audit does not read `/.well-known/webmcp`. The manifest has no spec, and the path is not in the orchestrator's `rootFilePaths`.
- Neither signal in `## Evidence` grades this mechanism. The grade-D manifest signal was dropped with the manifest check. The grade-A soft-404 rule has no well-known path to apply to here; `openapi-exists` applies it.
- The B rests on Google Lighthouse 13.3+, which reports "Registered WebMCP tools" from a live browser. The tier is `experimental` because this scanner has no JavaScript runtime.
- `navigator.modelContext` must appear in an inline script before anything is reported.
- Tool names come from `registerTool("name", …)` and from a `name:` key inside the arguments of `registerTool`, `registerTools` or `provideContext`, found by a paren-depth walk. Names are deduplicated across pages.
- External scripts are not fetched. A tool registered from a bundle is invisible, so silence is `na`, not absence.
- A site whose only WebMCP markup is `<form toolname>` is `na`. `webmcp-declarative-forms` owns that path.
- The audit never fails.

## Deferred

- With a headless-browser gatherer, read `navigator.modelContext.getTools()` after load, collapse the `warn` and `na` branches, and re-examine the tier.
