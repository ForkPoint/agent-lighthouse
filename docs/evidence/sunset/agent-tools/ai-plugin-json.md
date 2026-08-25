---
audit: agent-tools/ai-plugin-json
category: agent-tools
audit_id: "5.11"
source_file: packages/core/src/audits/agent-tools/ai-plugin-json.ts
slug: ai-plugin-json
review_verdict: delete
severity: high
disposition: "sunset (approved 2026-08-21)"
status: sunset
verdict: dead
evidence_grade: D
reviewed: 2026-08-21
---

# ai-plugin-json — confirmed dead — delete

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **D**.

## Claimed mechanism (steelmanned)

Steelmanned: /.well-known/ai-plugin.json was a genuine, vendor-defined manifest — OpenAI specified it, ChatGPT read it to install third-party plugins, and it carried fields (name_for_model, description_for_model, api.url pointing at an OpenAPI spec) purpose-built for model consumption rather than human display. The audit's fallback claim is broader than ChatGPT: that the format became a de-facto cross-vendor tool manifest, so 'even if you do not build a ChatGPT plugin' the file helps any agent understand the site as a callable tool. For the audit to matter, some currently-shipping agent would have to fetch that path and act on it.

## What we searched

With WebSearch unavailable I went straight to OpenAI's own properties. I attempted OpenAI's help-center deprecation article (HTTP 403, blocked). I then tested the audit's own docsUrl and the plugins docs root with curl following redirects, to establish whether OpenAI still publishes the manifest spec. I fetched developers.openai.com/apps-sdk to determine what OpenAI's current third-party extensibility mechanism actually is. I used the GitHub API to check the archival status and README of OpenAI's official openai/plugins-quickstart and openai/chatgpt-retrieval-plugin repos, which is where an official deprecation notice would live. I checked the IANA Well-Known URIs registry for an 'ai-plugin' registration. Finally I fetched the GPT Actions docs to confirm what replaced plugins.

## Best evidence found for the audit

The best evidence for the audit is historical only: ai-plugin.json was unambiguously a real, first-party OpenAI-specified manifest with a documented consumer (ChatGPT) during the 2023 plugins beta, and OpenAI's official quickstart repo still has 4,236 stars attesting to that era. I could find no currently-shipping consumer of the path on any vendor property. Searching for a surviving cross-vendor role turned up nothing: no Anthropic, Google, Microsoft, or Perplexity documentation references ai-plugin.json, and the path is not in the IANA registry. The strongest surviving artifact is a stars count on an archived repo — that is, evidence the format once mattered, not that it now does.

## Counter-evidence

Direct positive proof of discontinuation: (1) OpenAI's official openai/plugins-quickstart repository is ARCHIVED (GitHub API archived=true), with last push 2024-01-30T23:23:11Z, and its README states verbatim: 'Plugins have been superseded by GPTs, learn more about creating a GPT with actions.' (2) OpenAI deleted the manifest specification from its docs entirely: the audit's own docsUrl https://platform.openai.com/docs/plugins/getting-started/plugin-manifest 301-redirects to https://developers.openai.com/api/docs/actions, which returns HTTP 404. The plugins docs root https://platform.openai.com/docs/plugins/introduction resolves to the same 404. There is no longer any OpenAI page describing ai-plugin.json. (3) OpenAI's current third-party extensibility surface, the Apps SDK, is built on MCP, not on plugin manifests — its docs describe building an MCP server to give an app 'tools and access to external systems' and never mention ai-plugin.json or plugin manifests. (4) The GPT Actions documentation that replaced plugins makes no reference to ai-plugin.json. (5) 'ai-plugin' / 'ai-plugin.json' are absent from the IANA Well-Known URIs registry.

## Verdict

**confirmed dead — delete** (grade D)

Grade D: the sole documented consumer (ChatGPT plugins) was discontinued, OpenAI archived its official quickstart with an explicit 'superseded by GPTs' notice, and OpenAI removed the manifest spec from its documentation so thoroughly that the audit's own docsUrl now 404s. No successor vendor adopted the format; OpenAI itself moved to MCP via the Apps SDK. The audit is worse than merely useless — it actively penalizes sites for omitting a manifest for a shut-down program and hands users a 404 link as remediation guidance. This is the cleanest 'dead' of the four: it fails not for lack of evidence but on positive proof of discontinuation. If any of the four had a case for being retained as a cautionary/informative example of a deprecated agent standard, it would be this one, but the rubric's grade-D rule is unambiguous and the audit as written scores sites against it.

## Sources

- **[openai/plugins-quickstart (ARCHIVED) — official ChatGPT plugin quickstart](https://github.com/openai/plugins-quickstart)** — OpenAI (repo, URL verified 2026-08-21)
  - GitHub API confirms archived=true, pushed_at=2024-01-30T23:23:11Z, 4,236 stars. README states verbatim: 'Plugins have been superseded by GPTs, learn more about creating a GPT with actions.' This is OpenAI's own first-party notice that the plugins program (and its ai-plugin.json manifest) is over.
- **[OpenAI plugin manifest documentation — removed (301 to 404)](https://platform.openai.com/docs/plugins/getting-started/plugin-manifest)** — OpenAI (vendor-doc, URL verified 2026-08-21)
  - curl -L shows a single 301 to https://developers.openai.com/api/docs/actions, which returns HTTP 404 (final_code=404). The plugins docs root /docs/plugins/introduction lands on the same 404. This is the exact docsUrl the audit ships, so its remediation link is broken; OpenAI no longer publishes any ai-plugin.json specification.
- **[OpenAI Apps SDK — current third-party extensibility, built on MCP](https://developers.openai.com/apps-sdk/)** — OpenAI (vendor-doc, URL verified 2026-08-21)
  - OpenAI's current mechanism for third-party apps in ChatGPT uses the Model Context Protocol: docs describe building an MCP server to 'add live data and controlled tools' and give an app 'tools and access to external systems.' No mention of ai-plugin.json or plugin manifests anywhere — confirming the successor is MCP, not a revived manifest.
- **[GPT Actions — Introduction](https://developers.openai.com/api/docs/actions/introduction)** — OpenAI (vendor-doc, URL verified 2026-08-21)
  - The successor documentation to plugins. Explains Actions via Function Calling with an OpenAPI example; contains no reference to ai-plugin.json, plugin manifests, or the /.well-known/ path.
- **[IANA Well-Known URIs Registry (checked for ai-plugin)](https://www.iana.org/assignments/well-known-uris/well-known-uris.xhtml)** — IANA (spec, URL verified 2026-08-21)
  - 'ai-plugin' and 'ai-plugin.json' are absent from the 180+ registered well-known suffixes — the path was never standardized beyond OpenAI's own vendor convention, so nothing outlived the program's shutdown.
- **[Winding down the ChatGPT plugins beta (OpenAI Help Center)](https://help.openai.com/en/articles/8988022-winding-down-the-chatgpt-plugins-beta)** — OpenAI (announcement, URL verified 2026-08-21)
  - (Resolves; returns 403 to non-browser clients — page exists, bot-blocked.) Could not be verified — the help center returned HTTP 403 to automated fetching, and web.archive.org is not fetchable from this environment. No claim is based on this document; the discontinuation is instead established by the archived openai/plugins-quickstart repo and the 404'd manifest docs, both verified directly.

## v1 dossier — what it checked and the 2026-08-20 code review

Merged in on 2026-08-22 from `docs/evidence/audits/agent-tools/ai-plugin-json.md`, so a removed audit has exactly one dossier and it lives here.

### What it checks

ai-plugin.json is the ChatGPT plugin manifest format. Even if you do not build a ChatGPT plugin, having this file helps AI agents understand your site as a tool with human-readable and model-readable names, logos, and API references.

### Code review findings (2026-08-20, 11-agent pass)

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

### Evidence

#### Signal: ai-plugin-json — grade D (agent-action-surfaces)

**Mechanism:** Publishing /.well-known/ai-plugin.json (the ChatGPT plugin manifest pointing at an OpenAPI spec) makes a site's API callable by ChatGPT.

**Evidence:** This mechanism is definitively dead and has been for over two years. OpenAI's announced timeline: 'On March 19, 2024, you will no longer be able to install new plugins or create new conversations with existing plugins. You will be able to continue existing conversations until April 9, 2024.' OpenAI's own reference implementation, github.com/openai/plugins-quickstart, is ARCHIVED with a last push of 2024-01-30 and a README stating 'Plugins have been superseded by GPTs, learn more about creating a GPT with actions.' The successor path is GPT Actions, which consume an OpenAPI schema directly and have no manifest file at all; the successor to that for tool-calling is MCP via the Apps SDK.

**Counter-evidence:** Confirming absence: `ai-plugin.json` is NOT in the IANA Well-Known URIs registry, OpenAI's current deprecations page contains no plugin entry (plugins predate its scope entirely), the platform.openai.com/docs/plugins URL that plugins-quickstart links to no longer exists, and no current OpenAI documentation page — Actions, Apps SDK, or deprecations — mentions ai-plugin.json. False-positive hazard for the audit: zapier.com returns HTTP 200 with content-type text/html for /.well-known/ai-plugin.json, a soft-404 that a status-code-only check would misread as adoption. Note also that help.openai.com and openai.com return HTTP 403 to automated fetches, so the OpenAI Developer Community thread is the citable carrier of the primary quote.
**Consumers:** none-known (formerly ChatGPT Plugins, retired 2024) · **Recommended tier:** delete

**Sources:** [Plugin Store and New Chats With Plugins — Closed March 19 2024](https://community.openai.com/t/plugin-store-and-new-chats-with-plugins-closed-march-19-2024/689877) · [openai/plugins-quickstart (ARCHIVED) — official ChatGPT plugin quickstart](https://github.com/openai/plugins-quickstart) · [OpenAI API — Deprecations](https://developers.openai.com/api/docs/deprecations) · [OpenAI — Getting started with GPT Actions](https://developers.openai.com/api/docs/actions/getting-started) · [IANA Well-Known URIs registry](https://www.iana.org/assignments/well-known-uris/well-known-uris.xhtml) · [Live deployment: Zapier /.well-known/ai-catalog.json](https://zapier.com/.well-known/ai-catalog.json)

#### Signal: agent-surface-soft-404-validation — grade A (agent-action-surfaces)

**Mechanism:** A well-known or conventional agent-discovery path that returns HTTP 200 with an HTML body (an SPA catch-all rather than a real document) is worse than a 404, because a conforming client follows the standard, fails to parse, and has no recourse — so any audit must validate content-type and parseability, not status code.

**Evidence:** This is a meta-signal about how the other audits must be implemented, and it is the best-evidenced claim in the whole domain. The May 2026 API Evangelist study of 74 providers found that of the ~72 that did not serve a valid catalog, only TWO returned a clean 404 while SIXTY-EIGHT returned HTTP 200 with an HTML body, and concluded: 'an agent following the standard would get a 200, try to parse a LinkSet out of the body, fail, and have no useful recourse — an HTML 200 at a well-known path lies, which is worse than a 404.' My own probe on 2026-08-20 reproduced this independently across a different path set: linear.app returned 200 text/html for /openapi.json; github.com, linear.app, vercel.com and zapier.com returned 200 text/html for /mcp; zapier.com returned 200 text/html for /.well-known/ai-plugin.json. A status-code-only scanner would have reported all of these as adoption. Correct rule: require a JSON/YAML/linkset content-type, require the body to parse, and where a spec names a media type prefer it (application/ai-catalog+json for AI catalogs, application/linkset+json with the RFC 9727 profile for api-catalog, application/mcp-server-card+json for card entries) — Vercel demonstrates all of this is achievable in production.

**Counter-evidence:** None found — this is a validation-correctness requirement, not a contested adoption claim. The only nuance is that content negotiation is legitimate: RFC 9727 permits additional formats beyond the mandatory Linkset, so an audit should send an explicit Accept header before concluding a publisher is non-conformant, and should not penalise a clean 404 (which is honest) the way it penalises an HTML 200 (which is a lie).
**Consumers:** all clients following RFC 8615 well-known conventions · **Recommended tier:** scored

**Sources:** [Only Four API Providers Publish a Real .well-known/api-catalog Right Now](https://apievangelist.com/blog/2026/05/22/four-providers-publishing-well-known-api-catalog/) · [RFC 9727 — api-catalog: A Well-Known URI and Link Relation to Help Discovery of APIs](https://www.rfc-editor.org/rfc/rfc9727.html) · [experimental-ext-server-card — docs/discovery.md](https://raw.githubusercontent.com/modelcontextprotocol/experimental-ext-server-card/main/docs/discovery.md) · [Live deployment: Vercel /.well-known/api-catalog (RFC 9727)](https://vercel.com/.well-known/api-catalog) · [Live deployment: Vercel /.well-known/ai-catalog.json](https://vercel.com/.well-known/ai-catalog.json) · [Live deployment: Zapier /.well-known/api-catalog](https://zapier.com/.well-known/api-catalog)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **sunset** (graceful sunset per evidence-policy deprecation process; condensed rationale kept in not-a-factor.md).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.

- 2026-08-22 — v1 dossier merged in from `docs/evidence/audits/agent-tools/ai-plugin-json.md`; that copy removed (one dossier per removed audit, under `sunset/`).
