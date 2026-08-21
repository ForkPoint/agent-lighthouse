---
audit: agent-tools/ai-plugin-json
audit_id: "5.11"
category: agent-tools
source_file: packages/core/src/audits/agent-tools/ai-plugin-json.ts
slug: ai-plugin-json
review_verdict: delete
severity: high
evidence_grade: D
disposition: "sunset (approved 2026-08-21)"
reviewed: 2026-08-21
---

# ai-plugin-json (`5.11`)

> agent-tools · source `ai-plugin-json.ts` · review verdict **delete** · evidence grade **D** · disposition: **sunset (approved 2026-08-21)**

## What it checks

ai-plugin.json is the ChatGPT plugin manifest format. Even if you do not build a ChatGPT plugin, having this file helps AI agents understand your site as a tool with human-readable and model-readable names, logos, and API references.

## Code review findings (2026-08-20, 11-agent pass)

Dead standard presented as live. ai-plugin.json was the ChatGPT plugin manifest; OpenAI deprecated plugins in 2024 and shut the plugin store down. The audit's description and impact text assert it is 'the standard manifest used by ChatGPT and other AI platforms' and that without it 'your site cannot be installed as a plugin' — factually wrong guidance in 2026, delivered as a scored failure with a link to deprecated OpenAI docs.

**Required fix:** Delete. The residual value (pointing agents at an OpenAPI spec) is already covered by 5.1. If any trace is kept it must be `scoreDisplayMode: 'informative'` with copy stating the format is deprecated.

**False-positive risks:**
- Every site fails, and the accompanying explanation is untrue: there is no plugin installation flow to miss out on.
- `guidance.docsUrl` points at platform.openai.com/docs/plugins/..., a deprecated/removed documentation page — the user is sent to a dead end.
- Only checks that `schema_version`, `name_for_human`, `name_for_model` are non-empty strings; a site could satisfy it with three junk strings and no `api` block, i.e. a manifest that would have been useless even when plugins existed.
- SPA catch-all HTML → 'not valid JSON' misdiagnosis.

**Test gaps:**
- No test asserting the `api.url` field (the only part that ever mattered) is validated
- No test covering the deprecation — the suite treats the standard as live

**Overlaps with:** `5.1`, `5.10`

## Evidence

### Signal: ai-plugin-json — grade D (agent-action-surfaces)

**Mechanism:** Publishing /.well-known/ai-plugin.json (the ChatGPT plugin manifest pointing at an OpenAPI spec) makes a site's API callable by ChatGPT.

**Evidence:** This mechanism is definitively dead and has been for over two years. OpenAI's announced timeline: 'On March 19, 2024, you will no longer be able to install new plugins or create new conversations with existing plugins. You will be able to continue existing conversations until April 9, 2024.' OpenAI's own reference implementation, github.com/openai/plugins-quickstart, is ARCHIVED with a last push of 2024-01-30 and a README stating 'Plugins have been superseded by GPTs, learn more about creating a GPT with actions.' The successor path is GPT Actions, which consume an OpenAPI schema directly and have no manifest file at all; the successor to that for tool-calling is MCP via the Apps SDK.

**Counter-evidence:** Confirming absence: `ai-plugin.json` is NOT in the IANA Well-Known URIs registry, OpenAI's current deprecations page contains no plugin entry (plugins predate its scope entirely), the platform.openai.com/docs/plugins URL that plugins-quickstart links to no longer exists, and no current OpenAI documentation page — Actions, Apps SDK, or deprecations — mentions ai-plugin.json. False-positive hazard for the audit: zapier.com returns HTTP 200 with content-type text/html for /.well-known/ai-plugin.json, a soft-404 that a status-code-only check would misread as adoption. Note also that help.openai.com and openai.com return HTTP 403 to automated fetches, so the OpenAI Developer Community thread is the citable carrier of the primary quote.
**Consumers:** none-known (formerly ChatGPT Plugins, retired 2024) · **Recommended tier:** delete

**Sources:** [Plugin Store and New Chats With Plugins — Closed March 19 2024](https://community.openai.com/t/plugin-store-and-new-chats-with-plugins-closed-march-19-2024/689877) · [openai/plugins-quickstart (ARCHIVED) — official ChatGPT plugin quickstart](https://github.com/openai/plugins-quickstart) · [OpenAI API — Deprecations](https://developers.openai.com/api/docs/deprecations) · [OpenAI — Getting started with GPT Actions](https://developers.openai.com/api/docs/actions/getting-started) · [IANA Well-Known URIs registry](https://www.iana.org/assignments/well-known-uris/well-known-uris.xhtml) · [Live deployment: Zapier /.well-known/ai-catalog.json](https://zapier.com/.well-known/ai-catalog.json)

### Signal: agent-surface-soft-404-validation — grade A (agent-action-surfaces)

**Mechanism:** A well-known or conventional agent-discovery path that returns HTTP 200 with an HTML body (an SPA catch-all rather than a real document) is worse than a 404, because a conforming client follows the standard, fails to parse, and has no recourse — so any audit must validate content-type and parseability, not status code.

**Evidence:** This is a meta-signal about how the other audits must be implemented, and it is the best-evidenced claim in the whole domain. The May 2026 API Evangelist study of 74 providers found that of the ~72 that did not serve a valid catalog, only TWO returned a clean 404 while SIXTY-EIGHT returned HTTP 200 with an HTML body, and concluded: 'an agent following the standard would get a 200, try to parse a LinkSet out of the body, fail, and have no useful recourse — an HTML 200 at a well-known path lies, which is worse than a 404.' My own probe on 2026-08-20 reproduced this independently across a different path set: linear.app returned 200 text/html for /openapi.json; github.com, linear.app, vercel.com and zapier.com returned 200 text/html for /mcp; zapier.com returned 200 text/html for /.well-known/ai-plugin.json. A status-code-only scanner would have reported all of these as adoption. Correct rule: require a JSON/YAML/linkset content-type, require the body to parse, and where a spec names a media type prefer it (application/ai-catalog+json for AI catalogs, application/linkset+json with the RFC 9727 profile for api-catalog, application/mcp-server-card+json for card entries) — Vercel demonstrates all of this is achievable in production.

**Counter-evidence:** None found — this is a validation-correctness requirement, not a contested adoption claim. The only nuance is that content negotiation is legitimate: RFC 9727 permits additional formats beyond the mandatory Linkset, so an audit should send an explicit Accept header before concluding a publisher is non-conformant, and should not penalise a clean 404 (which is honest) the way it penalises an HTML 200 (which is a lie).
**Consumers:** all clients following RFC 8615 well-known conventions · **Recommended tier:** scored

**Sources:** [Only Four API Providers Publish a Real .well-known/api-catalog Right Now](https://apievangelist.com/blog/2026/05/22/four-providers-publishing-well-known-api-catalog/) · [RFC 9727 — api-catalog: A Well-Known URI and Link Relation to Help Discovery of APIs](https://www.rfc-editor.org/rfc/rfc9727.html) · [experimental-ext-server-card — docs/discovery.md](https://raw.githubusercontent.com/modelcontextprotocol/experimental-ext-server-card/main/docs/discovery.md) · [Live deployment: Vercel /.well-known/api-catalog (RFC 9727)](https://vercel.com/.well-known/api-catalog) · [Live deployment: Vercel /.well-known/ai-catalog.json](https://vercel.com/.well-known/ai-catalog.json) · [Live deployment: Zapier /.well-known/api-catalog](https://zapier.com/.well-known/api-catalog)

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/agent-tools/ai-plugin-json.md](../../deletions/agent-tools/ai-plugin-json.md). Outcome: **dead**, grade D.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
