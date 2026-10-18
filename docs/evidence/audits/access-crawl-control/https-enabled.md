---
audit: access-crawl-control/https-enabled
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/https-enabled.ts
slug: https-enabled
evidence_grade: B
disposition: "keep — fix required; re-graded A to B 2026-10-18 (the A belonged to the WAF signal, which moved to ai-crawler-edge-parity)"
reviewed: 2026-10-18
recommended_tier: scored
consumers:
  - MCP authorization clients
  - Chromium-based browser agents (HTTPS-First, HTTPS by default)
signals:
  - name: "HTTPS requirement (TLS, valid certificate, HTTP→HTTPS redirect)"
    grade: B
    domain: technical-infra
sources:
  - mcp-spec-authorization
  - rfc9116
  - google-ai-features-trust
  - s18
  - anthropic-crawlers
  - perplexity-crawlers-docs
  - s21
  - s2
  - chrome-https-by-default
---

# https-enabled (`8.1`)

> technical-readiness · source `https-enabled.ts` · review verdict **fix** · evidence grade **B** · scored (weight 0.6) · disposition: **keep — fix required**

## What it checks

Whether the site is served over HTTPS.

| State                                             | Result                      |
| :------------------------------------------------ | :-------------------------- |
| the scanned URL uses plain `http://`              | `fail`, priority `critical` |
| HTTPS, and the homepage returned a document       | `pass`                      |
| HTTPS, and the homepage answered with no document | `warn`, priority `high`     |

The claim behind it is narrower than "AI crawlers refuse HTTP". No AI crawler vendor documents that, and GPTBot, ClaudeBot and PerplexityBot are ordinary HTTP clients that fetch `http://` URLs. What is documented is that agent protocols and HTTPS-only well-known files require TLS, and that browser-based agents inherit Chromium's mixed-content and HTTPS-First behaviour.

## Evidence

### Signal: HTTPS requirement (TLS, valid certificate, HTTP→HTTPS redirect) — grade B (technical-infra)

**Mechanism:** Serving the site over HTTPS with a valid certificate is a precondition for AI-agent surfaces to retrieve or act on the site. Agent-protocol specs mandate HTTPS outright. Well-known agent and security files are defined as HTTPS-only. Browser-based agents inherit Chromium's mixed-content and HTTPS-First behaviour. Falsifiable form: an equivalent page served only over plaintext HTTP is retrieved and used less often by AI agents than the same page over HTTPS.

**Grade: B** — The evidence is strong but it comes from agent-adjacent specifications rather than from crawler documentation. MCP states that "All authorization server endpoints MUST be served over HTTPS". The well-known agent and security files are defined HTTPS-only. Browser-based agents inherit Chromium's mixed-content and HTTPS-First behaviour. An agent surface that requires HTTPS genuinely cannot be reached without it. What is missing for an A is a crawler vendor saying so: OpenAI's, Anthropic's and Perplexity's crawler documents say nothing about TLS, and their crawlers are ordinary HTTP clients that will fetch `http://` URLs. The strict claim "AI crawlers refuse HTTP" is unproven, and the audit does not make it.

**Evidence:** Strongest evidence is from agent-adjacent ratified/near-ratified specs rather than crawler docs. MCP (2025-11-25) states plainly: 'All authorization server endpoints MUST be served over HTTPS', and 'All redirect URIs MUST be either localhost or use HTTPS' (https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization, verified 2026-10-17). Client ID Metadata Documents are required at HTTPS URLs. Any MCP-exposed site capability is therefore unreachable without TLS. RFC 9116 requires security.txt to be 'accessed exclusively via HTTPS'. Browser-resident agents (ChatGPT Atlas, Comet, Gemini-in-Chrome, Claude in Chrome) run on Chromium and therefore inherit mixed-content blocking and HTTPS-First warnings, so an HTTP-only page degrades for the fastest-growing agent class. Google's AI-features eligibility runs through normal Search indexing, where HTTPS has been a documented positive signal since 2014.

**Counter-evidence:** No AI crawler vendor documents HTTPS as a requirement. OpenAI's crawler documentation (https://developers.openai.com/api/docs/bots), Anthropic's crawler support article (https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) and Perplexity's (https://docs.perplexity.ai/guides/bots) all say nothing about TLS (all verified 2026-10-17); GPTBot, ClaudeBot and PerplexityBot are ordinary HTTP clients and will fetch http:// URLs. So the strict claim 'AI crawlers refuse HTTP' is unproven and should not be asserted. The honest claim is narrower: HTTPS is mandatory for agent protocols and browser-based agents, and is a universal baseline (>95% of page loads) such that its absence is a strong negative quality signal. HSTS specifically has no documented AI consumer at all — see the security-headers signal.

## Scoring

Scored (weight 0.6), ternary.

**Grade: B** — MCP authorization and Chromium's HTTPS-by-default document refusing or gating plain HTTP for agent surfaces. Google states that "with the release of Chrome 154 in October 2026, we will change the default settings of Chrome to enable" Always Use Secure Connections, so "Chrome will ask for the user's permission before the first access to any public site without HTTPS" — https://security.googleblog.com/2025/10/https-by-default.html (verified 2026-10-18). Gemini in Chrome, Claude in Chrome, ChatGPT Atlas and Comet are Chromium-based. No AI crawler documents refusing HTTP, so the grade stops at B.

## Implementation deviations

- The plain-HTTP fail needs no response. The scheme is a property of the request, so the audit declares no `requires` keys and a walled HTTP site still fails.
- With no homepage document, the audit warns that the response carried no document. It does not name a status: `origin-reachable` accepts any 2xx, and the audit holds no homepage `FetchResult` on that branch.
- Plumbing the homepage status onto `CheckContext` was considered and not done. Every caller that builds a context would carry a field one branch of one audit reads.
- **Re-graded A to B on 2026-10-18.** The A came from the WAF / bot-management
  signal, and this audit never measures a WAF: it reads the URL scheme and
  whether the homepage returned a document. That signal and its Cloudflare
  sources moved to `access-crawl-control/ai-crawler-edge-parity`, which
  measures the edge answer per crawler user agent.
