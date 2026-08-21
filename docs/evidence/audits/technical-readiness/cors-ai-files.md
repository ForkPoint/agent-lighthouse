---
audit: technical-readiness/cors-ai-files
audit_id: "8.8"
category: technical-readiness
source_file: packages/core/src/audits/technical-readiness/cors-ai-files.ts
slug: cors-ai-files
review_verdict: fix
severity: high
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# cors-ai-files (`8.8`)

> technical-readiness · source `cors-ai-files.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

Without CORS headers, AI agents running in browser contexts cannot fetch your llms.txt or API spec. Browser-based AI tools, ChatGPT plugins, and MCP clients are all blocked by same-origin policy, making your AI-facing files completely inaccessible to cross-origin agents.

## Code review findings (2026-08-20, 11-agent pass)

Right idea, wrong probe. It sends `method: 'OPTIONS'` to /llms.txt and /.well-known/ai-catalog.json and judges CORS by the ACAO header on that response. But a cross-origin `GET` of a text/JSON file is a *simple request* — it never triggers a preflight, so OPTIONS support is irrelevant; what governs access is the ACAO header on the GET response. Static hosts (nginx, S3, most CDNs) answer OPTIONS on a static file with 405/501 and no CORS headers while serving `Access-Control-Allow-Origin: *` on the GET. Those sites are failed. Worse, the correct GET headers are already sitting in `ctx.rootFiles[path].headers` and the audit ignores them entirely to make a second, wrong request. It also charges a 0.5 `warn` to sites that simply have no llms.txt.

**Required fix:** Read `ACAO` from the GET responses already in `ctx.rootFiles` first, and only fall back to an OPTIONS probe when the GET response lacks the header — never fail on OPTIONS alone. Accept `*` (and echo-of-Origin) as pass; downgrade a same-origin-only ACAO to warn with an explanation. Return `notApplicable()` instead of `warn()` when the files do not exist. Drop /.well-known/ai-catalog.json from the checked set (or gate it on the file actually existing and being valid), and scope the rationale to browser-context agents rather than claiming 'ChatGPT plugins and MCP clients' are blocked — MCP clients are server-side and unaffected by CORS.

**False-positive risks:**
- Wrong method: `await ctx.fetch({url, method: 'OPTIONS'})` then `result.headers['access-control-allow-origin']`. Static file servers that return 405 to OPTIONS but `ACAO: *` on GET → reported as 'No AI files have CORS headers' (fail, and the copy says agents 'cannot access these files' — flatly untrue).
- Ignores available truth: `ctx.rootFiles['/llms.txt']` already holds the real GET response headers from Phase 1 of the scan; they are never consulted.
- Absence penalized as a defect: `if (hasRootFiles && existingAiPaths.length === 0) return this.warn(…)` — a site with no llms.txt and no ai-catalog.json takes a 0.5 hit here, plus another in 8.10 and another in 8.11, for the same non-existent files. Should be `na`.
- Presence-only ACAO: `acaoValue === '*' || acaoValue.length > 0` passes on `Access-Control-Allow-Origin: https://internal.corp.example` — an origin no AI agent will ever match — and reports 'All AI files have CORS headers'.
- `/.well-known/ai-catalog.json` is a convention with essentially no consumer adoption; half the audit's subject matter is speculative (see obsolete note).
- Fallback branch `existingAiPaths = aiPaths` when `rootFiles` is empty means a scan that failed to fetch anything still issues two live OPTIONS requests and can fail the site.

**Test gaps:**
- No test where OPTIONS returns 405/501 but the corresponding rootFiles GET carries `ACAO: *` — the dominant real-world configuration.
- No test that reads CORS off the already-fetched GET response.
- No test that a site with no AI files yields `na` rather than a 0.5 warn.
- No test for a narrow non-wildcard ACAO that would not actually admit an AI agent (the existing test asserts such a value PASSES).
- No test for redirects on /llms.txt (e.g. → /docs/llms.txt) where the ACAO lands on a different response.

**Overlaps with:** `8.10`, `8.11`, `8.9`

## Evidence

### Signal: CORS headers on public AI files and API routes — grade C (technical-infra)

**Mechanism:** CLAIM UNDER TEST: serving Access-Control-Allow-Origin (typically '*') on llms.txt, .md mirrors, feeds and public JSON endpoints is required for AI agents to fetch and use them. FALSIFIABLE FORM: an AI consumer that can read a resource when ACAO is present fails to read the same resource when it is absent.

**Evidence:** The mechanism is real but its scope is much narrower than the audit implies. CORS matters only for code running inside a browser origin: MDN states 'browsers restrict cross-origin HTTP requests initiated from scripts', and the server merely opts in via ACAO. The genuine AI consumer class is browser-sandboxed agent code — OpenAI's Apps SDK widgets run in an isolated iframe under a strict CSP and must declare connect_domains (mapped to connect-src) for every origin they will fetch from; such a widget fetching a publisher's JSON or llms.txt cross-origin WILL be blocked without ACAO. That class is small today but growing.

**Counter-evidence:** Decisive counter-evidence for the general case: GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, PerplexityBot and every server-side agent backend are non-browser HTTP clients. They do not implement the same-origin policy and are completely unaffected by a missing Access-Control-Allow-Origin header. Browser extensions with host permissions (the Claude-in-Chrome / sidebar class) also bypass CORS. No AI vendor doc requires CORS on publisher resources, and the llms.txt spec says nothing about it. Therefore 'missing CORS blocks AI agents' is FALSE as a general claim. Recommend rewording the audit to target only browser-embedded agent consumption and demoting it out of the score.
**Consumers:** OpenAI Apps SDK widgets (browser-sandboxed), in-browser agent JS, none-known among server-side crawlers · **Recommended tier:** informative

**Sources:** [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS) · [Security & Privacy — Apps SDK](https://developers.openai.com/apps-sdk/guides/security-privacy) · [The /llms.txt file](https://llmstxt.org/) · [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) · [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
