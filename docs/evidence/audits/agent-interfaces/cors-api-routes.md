---
audit: agent-interfaces/cors-api-routes
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/cors-api-routes.ts
slug: cors-api-routes
evidence_grade: C
disposition: "kept — rebuilt spec-driven, na without an API surface 2026-08-22 (Plan 4, Task 16)"
reviewed: 2026-08-22
recommended_tier: informative
consumers:
  - OpenAI Apps SDK widgets (browser-sandboxed)
  - in-browser agent JS
  - none-known among server-side crawlers
signals:
  - name: CORS headers on public AI files and API routes
    grade: C
    domain: technical-infra
sources:
  - mdn-cors
  - openai-apps-sdk-security
  - llmstxt-spec-link
  - s18
  - anthropic-crawlers
---

# cors-api-routes (`8.9`)

> agent-interfaces · source `cors-api-routes.ts` · evidence grade **C** · tier **informative** (weight 0) · rebuilt from a hardcoded `/api/` probe to spec-driven probing of the endpoints the OpenAPI document declares — see below

## What it checks

CORS matters for one class of AI consumer: agent code running inside a browser origin, such as an OpenAI Apps SDK widget in an isolated iframe under a strict CSP. Server-side crawlers and MCP clients are not browsers and are unaffected. The audit reads the endpoints out of the published OpenAPI document, probes those, and applies only to sites that publish one.

It probes at most two declared endpoints. `Access-Control-Allow-Origin: *` passes. A named origin, or no header at all, warns. The audit never fails, and a site with no usable `/openapi.json` is not applicable.

A missing header does not block AI agents in general. Crawlers such as GPTBot and ClaudeBot, and server-side agent backends, do not enforce the same-origin policy, so they read the endpoint either way.

## Evidence

### Signal: CORS headers on public AI files and API routes — grade C (technical-infra)

**Mechanism:** The claim under test: serving Access-Control-Allow-Origin (typically '*') on llms.txt, .md mirrors, feeds and public JSON endpoints is required for AI agents to fetch and use them. Falsifiable form: an AI consumer that can read a resource when ACAO is present fails to read the same resource when it is absent.

**Evidence:** The mechanism is real but its scope is much narrower than the audit implies. CORS matters only for code running inside a browser origin: MDN states 'browsers restrict cross-origin HTTP requests initiated from scripts', and the server merely opts in via ACAO. The genuine AI consumer class is browser-sandboxed agent code. OpenAI's Apps SDK widgets run in an isolated iframe under a strict CSP, and must declare connect_domains — mapped to connect-src — for every origin they will fetch from. Such a widget fetching a publisher's JSON or llms.txt cross-origin will be blocked without ACAO. That class is small today but growing.

**Counter-evidence:** Decisive counter-evidence for the general case: GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, PerplexityBot and every server-side agent backend are non-browser HTTP clients. They do not implement the same-origin policy and are completely unaffected by a missing Access-Control-Allow-Origin header. Browser extensions with host permissions (the Claude-in-Chrome / sidebar class) also bypass CORS. No AI vendor doc requires CORS on publisher resources, and the llms.txt spec says nothing about it. Therefore 'missing CORS blocks AI agents' is false as a general claim. Recommend rewording the audit to target only browser-embedded agent consumption and demoting it out of the score.

## Implementation deviations

- The audit cannot fail. `Access-Control-Allow-Origin: *` passes; a named origin, a same-origin value or no ACAO warns.
- No usable `/openapi.json` is `notApplicable`. The file must be a 200, not `text/html`, and parse with a version key and a `paths` object.
- `/swagger.json` is not read. The orchestrator does not fetch it into `ctx.rootFiles`.
- Targets come from `servers[].url` plus concrete declared paths. Relative server urls resolve against the site base, and no `servers` array means `/`.
- `{variable}` templates expand from their `default`. A url still holding braces is dropped. Paths with `{param}` are skipped.
- At most two endpoints are probed, with OPTIONS first and GET as the fallback.
- Every target passes `isSafeUrl()`. A refused target warns with the reason.
- The grade stays C, tier `informative`. Re-examine it if a vendor documents a browser-sandboxed agent that needs publisher-side ACAO.
