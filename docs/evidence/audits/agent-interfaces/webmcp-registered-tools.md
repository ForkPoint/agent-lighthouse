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

_(The pre-rewrite audit demanded a `/.well-known/webmcp` manifest file. That artifact is invented; the grade-D evidence for it is below, unchanged, and the rewrite section records what replaced it.)_

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

## The registered-tools rewrite (Plan 4, Task 16, 2026-08-22)

**Old pass condition:** `/.well-known/webmcp` returns 200 with JSON containing a `tools` array holding at least one object with a `name` string. Anything else — including a 404, which is what essentially every site on the web returns — was a binary hard **fail** at `high` priority, weight 1.0 as originally shipped.

**New pass condition:** at least one tool name is observable in a `navigator.modelContext` registration in the served document. The API referenced with no observable name warns; a site with declarative forms only, or with nothing at all, is `notApplicable`. The audit can no longer fail anything.

### Why the manifest had to go, not be fixed

The evidence signal for the file is graded **D** and its recommended tier is `delete`: the WebMCP spec defines no manifest format at all (tools are registered imperatively in JavaScript, and the declarative HTML path is marked "entirely a TODO"), `webmcp` is not in the [IANA Well-Known URIs registry](https://www.iana.org/assignments/well-known-uris/well-known-uris.xhtml), and the two live deployments are mutually incompatible private schemas — Zapier's self-identifies as `"spec": "zapier-webmcp-discovery/1"` and concedes its tools "are not HTTP endpoints", so an agent must navigate to the page anyway. A site correctly implementing real WebMCP failed the old audit, because the real API leaves no static artifact to find. That is unsatisfiable-by-construction, which no threshold change repairs.

The `/.well-known/webmcp` entry was removed from the orchestrator's `rootFilePaths` in the same change: this audit was its only reader, so every scan was spending a request on a path nothing consumes.

### What replaced it, and why it grades B

The redemption note names the substitute: **Google Lighthouse 13.3+ ships a "Registered WebMCP tools" audit** in its Agentic Browsing category. The shipped-category evidence is recorded in [the competitor-gap dossier](../../proposals/competitor-gap-verify/google-lighthouse-agentic-browsing-category-shipped-complete.md), read off `core/config/agentic-browsing-config.js` on `main`: the category's six `auditRefs` include `webmcp-registered-tools`, which "dumps imperative + declarative tools with source location and inputSchema", and it is **informative** in Lighthouse too. So a shipped Google product reads exactly this signal off a live page — a real, named consumer, which the manifest never had.

The grade is **B**, not A, and the tier is `experimental`, because of how the consumer reads it. Lighthouse observes `navigator.modelContext` from an instrumented browser after load; this scanner has no JS runtime and matches source text in inline `<script>` elements. A tool registered from an external bundle is invisible to it, so a silent result cannot distinguish "no tools" from "cannot see the tools". Reporting that ambiguity as a score would be the same error the manifest check made in the other direction, so absence is `na` with the limitation stated in the message, and `weightForGrade('B', 'experimental') = 0`.

### Detection rules

- **`navigator.modelContext` must appear** in an inline script before anything is reported. `window.registerTool(...)` in an unrelated library is not WebMCP.
- **Tool names** come from `registerTool("name", …)` (string-first form) and from a `name:` key inside the *argument slice* of a `registerTool` / `registerTools` / `provideContext` call, located by a paren-depth walk. Scoping to the call's own source prevents an unrelated `name:` elsewhere in the file from being reported as a tool. Names are deduplicated across pages.
- **External scripts are not fetched.** Following every `<script src>` on every page would multiply a scan's request count for a weight-0 signal, and minified bundles would rarely match anyway.
- **Declarative forms are deferred**, not double-counted: a site whose only WebMCP adoption is `<form toolname>` returns `na` naming `agent-interfaces/webmcp-declarative-forms`, which owns that path. Imperative registration still reports when both are present.

### Grade decision: **A → B**, tier `experimental`, weight 0

Source: the [REWORK-TODO redemption note](../../../../packages/core/src/audits/REWORK-TODO.md) — "the .well-known manifest file is invented (grade D) — but runtime-registered WebMCP tools are grade B … Replace manifest-file audit with registered-tools detection, experimental tier." The frontmatter `evidence_grade` moves `A` → `B` to match: the A on this dossier came from the `agent-surface-soft-404-validation` signal, which is a validation rule for how *any* well-known audit must be implemented, not a grade for this audit's mechanism — and with the well-known path gone, it no longer applies here at all. `weightForGrade('B', 'experimental') = 0`, so `scoreDisplayMode` stays `informative`, and `defaultPriority` drops `high` → `low`. The pre-rewrite meta carried an explicit comment that its `A` was a placeholder pending this rewrite; that comment is now resolved rather than deferred.

### Re-check trigger

If this project gains a headless-browser gatherer, the audit should read `navigator.modelContext.getTools()` after load instead of matching source text. At that point the detector stops being partial, the `warn` and `na` branches collapse, and the tier should be re-examined against the same grade-B consumer. The trigger is stamped in the source file header.

## Evidence

### Signal: webmcp-well-known-manifest — grade D (agent-action-surfaces)

**Mechanism:** Publishing a manifest at /.well-known/webmcp (or /.well-known/webmcp.json) listing a site's WebMCP tools lets an agent discover those tools before navigating to the page.

**Evidence:** The idea is intuitively appealing — WebMCP tools are only visible after page load, so a pre-navigation index would help — and two real deployments exist: zapier.com/.well-known/webmcp (verified 2026-08-20) and cloudflare.com's mcp.json points at a /.well-known/webmcp.json. So the practice is being invented in the wild.

**Counter-evidence:** There is no standard for it and every deployment is a different private schema. The WebMCP spec defines NO manifest format at all — tools are registered imperatively in JavaScript, and the declarative HTML-form path in §4.3 is marked 'entirely a TODO'. `webmcp` is not in the IANA Well-Known URIs registry. Zapier's document self-identifies as `"spec": "zapier-webmcp-discovery/1"` — a vendor-versioned format of one — and its own description concedes the tools 'are not HTTP endpoints', so the manifest cannot be acted on remotely; an agent must still navigate to the page. The freeCodeCamp author shipped exactly this manifest on citability.dev and recorded zero agent calls five days later. Auditing for an undefined file with no schema and no consumer would generate advice no one can act on correctly.

### Signal: agent-surface-soft-404-validation — grade A (agent-action-surfaces)

**Mechanism:** A well-known or conventional agent-discovery path that returns HTTP 200 with an HTML body (an SPA catch-all rather than a real document) is worse than a 404, because a conforming client follows the standard, fails to parse, and has no recourse — so any audit must validate content-type and parseability, not status code.

**Evidence:** This is a meta-signal about how the other audits must be implemented, and it is the best-evidenced claim in the whole domain. The May 2026 API Evangelist study of 74 providers found that of the ~72 that did not serve a valid catalog, only TWO returned a clean 404 while SIXTY-EIGHT returned HTTP 200 with an HTML body, and concluded: 'an agent following the standard would get a 200, try to parse a LinkSet out of the body, fail, and have no useful recourse — an HTML 200 at a well-known path lies, which is worse than a 404.' My own probe on 2026-08-20 reproduced this independently across a different path set: linear.app returned 200 text/html for /openapi.json; github.com, linear.app, vercel.com and zapier.com returned 200 text/html for /mcp; zapier.com returned 200 text/html for /.well-known/ai-plugin.json. A status-code-only scanner would have reported all of these as adoption. Correct rule: require a JSON/YAML/linkset content-type, require the body to parse, and where a spec names a media type prefer it (application/ai-catalog+json for AI catalogs, application/linkset+json with the RFC 9727 profile for api-catalog, application/mcp-server-card+json for card entries) — Vercel demonstrates all of this is achievable in production.

**Counter-evidence:** None found — this is a validation-correctness requirement, not a contested adoption claim. The only nuance is that content negotiation is legitimate: RFC 9727 permits additional formats beyond the mandatory Linkset, so an audit should send an explicit Accept header before concluding a publisher is non-conformant, and should not penalise a clean 404 (which is honest) the way it penalises an HTML 200 (which is a lie).

## Composite check (contradiction sweep Task 10, 2026-08-24)

**No split. No tier change. B / experimental / weight 0 stands.**

This audit was carried on the sweep's Class A list — a composite holding two
researched signals whose recommended tiers disagree — and separately on the
retirement shortlist. Both were checked against the shipped code on 2026-08-24.
Neither still describes this audit.

**Signal 1, `webmcp-well-known-manifest` — grade D, `Recommended tier: delete`.**
Discharged on 2026-08-22. The `/.well-known/webmcp` check was deleted outright,
not demoted, and the path was removed from the orchestrator's `rootFilePaths`
because this audit was its only reader. A test pins that a manifest at that path
can no longer produce a pass, and another pins that the string
`.well-known/webmcp` appears nowhere in the audit's user-facing copy.

**Signal 2, `agent-surface-soft-404-validation` — grade A, `Recommended tier:
scored`.** Not applicable here, for the same reason it was not split out in
Task 6. It is a meta-signal — its own evidence calls it *"a meta-signal about
how the other audits must be implemented"* — requiring that any audit reading a
well-known path validate content-type and parseability rather than status code.
This audit reads no well-known path. It matches `navigator.modelContext`
registrations in inline `<script>` elements of the served document. There is no
surface for the rule to apply to. The rule itself ships, in
`agent-interfaces/openapi-exists`, whose `servedAsData()` rejects a `text/html`
body at `/.well-known/api-catalog`.

So the composite is not a composite any more: one signal was deleted with the
code that carried it, and the other belongs to a different audit. The surviving
mechanism — Lighthouse 13.3+ reading `navigator.modelContext` from an
instrumented browser, while this scanner has no JS runtime — is what grade **B**
and tier `experimental` already price, and `weightForGrade('B', 'experimental')`
is 0. `packages/core/src/audits/REWORK-TODO.md` recorded the same conclusion on
2026-08-22.

**Retirement:** also off. See the [shortlist
re-verification](../../RETIREMENT-SHORTLIST.md#re-verification-2026-08-24).

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-22 — user approved the pending-triage redeem; required rework executed (Plan 4, Task 16): the `/.well-known/webmcp` manifest check is deleted and replaced by runtime `navigator.modelContext` registration detection, absence is `na` with the JS-runtime limitation stated, declarative forms defer to `webmcp-declarative-forms`, and the path was removed from the orchestrator's `rootFilePaths`. Grade **A → B**, tier `experimental`, weight 0, `defaultPriority` `high` → `low`. Class renamed `WebmcpManifestAudit` → `WebmcpRegisteredToolsAudit`. `TODO(redeem)` marker removed from the source file.
- 2026-08-24 — contradiction sweep Task 10: checked as a composite, no split needed. The grade-D manifest signal was deleted with its code on 2026-08-22; the grade-A soft-404 signal is a meta-rule for audits that read a well-known path, which this one no longer does. B / experimental / 0 unchanged. Retirement also off.
