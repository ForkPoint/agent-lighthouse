---
audit: machine-discovery/cors-ai-files
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/cors-ai-files.ts
slug: cors-ai-files
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
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

# cors-ai-files (`8.8`)

> technical-readiness · source `cors-ai-files.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

Whether `/llms.txt` and `/.well-known/ai-catalog.json` answer a cross-origin request with `Access-Control-Allow-Origin`. Only agent code running inside a browser origin needs that header. Server-side crawlers, agent backends and MCP clients are not browsers and read the files either way.

The audit sends an OPTIONS preflight with `Origin` and `Access-Control-Request-Method: GET`, then a GET with `Origin` if the preflight carries no header. Either answer with the header counts.

## Evidence

### Signal: CORS headers on public AI files and API routes — grade C (technical-infra)

**Mechanism:** The claim under test: serving Access-Control-Allow-Origin (typically '*') on llms.txt, .md mirrors, feeds and public JSON endpoints is required for AI agents to fetch and use them. Falsifiable form: an AI consumer that can read a resource when ACAO is present fails to read the same resource when it is absent.

**Evidence:** The mechanism is real but its scope is much narrower than the audit implies. CORS matters only for code running inside a browser origin: MDN states 'browsers restrict cross-origin HTTP requests initiated from scripts', and the server merely opts in via ACAO. The genuine AI consumer class is browser-sandboxed agent code. OpenAI's Apps SDK widgets run in an isolated iframe under a strict CSP, and must declare connect_domains — mapped to connect-src — for every origin they will fetch from. Such a widget fetching a publisher's JSON or llms.txt cross-origin will be blocked without ACAO. That class is small today but growing.

**Counter-evidence:** Decisive counter-evidence for the general case: GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, PerplexityBot and every server-side agent backend are non-browser HTTP clients. They do not implement the same-origin policy and are completely unaffected by a missing Access-Control-Allow-Origin header. Browser extensions with host permissions (the Claude-in-Chrome / sidebar class) also bypass CORS. No AI vendor doc requires CORS on publisher resources, and the llms.txt spec says nothing about it. Therefore 'missing CORS blocks AI agents' is false as a general claim. Recommend rewording the audit to target only browser-embedded agent consumption and demoting it out of the score.

## Implementation deviations

- Before 2026-10-18 the probe sent OPTIONS with no `Origin` header. A browser always sends Origin on a cross-origin request, and many servers and CDNs emit ACAO only when it is present, so the probe read correctly configured files as missing CORS. The probe now sends `Origin: https://example.invalid` on an OPTIONS preflight (with `Access-Control-Request-Method: GET`) and on a GET fallback.
- The audit copy named "ChatGPT plugins", a retired product, and said MCP clients are blocked by the same-origin policy. MCP clients are not browsers. Both claims are removed.
