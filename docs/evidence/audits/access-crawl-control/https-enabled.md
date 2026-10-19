---
audit: access-crawl-control/https-enabled
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/https-enabled.ts
slug: https-enabled
evidence_grade: B
disposition: "keep; re-graded A to B 2026-10-18 (the A belonged to the WAF signal, which moved to ai-crawler-edge-parity); B rests on Chrome 154 alone"
reviewed: 2026-10-18
recommended_tier: scored
consumers:
  - Chrome 154+ (prompts before opening a public plain-http site)
signals:
  - name: "HTTPS requirement (TLS, valid certificate, HTTP→HTTPS redirect)"
    grade: B
    domain: technical-infra
sources:
  - chrome-154-release-notes
  - chrome-https-by-default
  - google-ai-features-trust
  - s18
  - anthropic-crawlers
  - perplexity-crawlers-docs
  - mcp-spec-authorization
---

# https-enabled (`8.1`)

> technical-readiness · source `https-enabled.ts` · evidence grade **B** · scored (weight 0.6) · disposition: **keep**

## What it checks

Whether the site is served over HTTPS.

| State                                             | Result                  |
| :------------------------------------------------ | :---------------------- |
| the scanned URL uses plain `http://`              | `fail`, priority `high` |
| HTTPS, and the homepage returned a document       | `pass`                  |
| HTTPS, and the homepage answered with no document | `warn`, priority `high` |

The claim is narrow. No AI crawler vendor documents refusing plain HTTP, and GPTBot, ClaudeBot and PerplexityBot fetch `http://` URLs. What is documented is that Chrome, since version 154, asks before it opens a public site over plain http.

## Evidence

### Signal: HTTPS requirement (TLS, valid certificate, HTTP→HTTPS redirect) — grade B (technical-infra)

**Mechanism claim:** Since Chrome 154, released on 2026-09-22, Chrome prompts by default when it connects to a site over plain http. An agent that works inside a Chrome tab, such as Gemini in Chrome or Claude in Chrome, meets that prompt on a first visit before any page content. No agent vendor documents how its agent handles the prompt.

**Evidence:** The Chrome 154 release notes say: "Ask before HTTP on by default. Chrome prompts users by default when they connect to a site over an insecure ( http ) connection." The stable release date is September 22, 2026 — https://developer.chrome.com/release-notes/154 (verified 2026-10-18). The Chrome Security Team's announcement of 2025-10-28 says Chrome "will ask for the user's permission before the first access to any public site without HTTPS". The prompt covers public sites only, is not repeated for sites a user visits regularly, and can be bypassed — https://blog.google/security/https-by-defau/ (verified 2026-10-18).

**Counter-evidence:** The crawler documentation of OpenAI (https://developers.openai.com/api/docs/bots), Anthropic (https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) and Perplexity (https://docs.perplexity.ai/docs/resources/perplexity-crawlers) says nothing about HTTPS or TLS (all verified 2026-10-18). Google's AI features have "no additional technical requirements" beyond Search eligibility, and HTTPS is not mentioned — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-10-18). No agent vendor documents what its agent does at Chrome's prompt, and nothing documents that Chromium-based browsers other than Chrome adopted the default. MCP requires HTTPS only for its optional authorization server endpoints and redirect URIs, not for the site — https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization (verified 2026-10-18). The audit reads only the scheme of the scanned base URL: it does not check the certificate chain, HSTS, or an HTTP-to-HTTPS redirect, and agent-protocol endpoints have their own HTTPS rules that belong in the audits that read them.

## Scoring

Scored (weight 0.6), ternary. A plain-http base URL fails at priority `high`, not `critical`: the documented cost is a prompt the user can bypass, not an outage.

**Grade: B** — one documented, shipped, default-on behaviour of a named user agent: Chrome 154 prompts before opening a public plain-http site — https://developer.chrome.com/release-notes/154 (verified 2026-10-18). An agent working inside Chrome meets that prompt; that step is an inference, because no agent vendor documents it. It is not A: no AI vendor states that its agent or crawler treats HTTPS differently. If the step from Chrome to the agents inside it is rejected, the grade falls to C.

## Implementation deviations

- The plain-HTTP fail needs no response. The scheme is a property of the request, so the audit declares no `requires` keys and a walled HTTP site still fails.
- With no homepage document, the audit warns that the response carried no document. It does not name a status: `origin-reachable` accepts any 2xx, and the audit holds no homepage `FetchResult` on that branch.
- Plumbing the homepage status onto `CheckContext` was considered and not done. Every caller that builds a context would carry a field one branch of one audit reads.
- **Re-graded A to B on 2026-10-18.** The A came from the WAF / bot-management
  signal, and this audit never measures a WAF: it reads the URL scheme and
  whether the homepage returned a document. That signal and its Cloudflare
  sources moved to `access-crawl-control/ai-crawler-edge-parity`, which
  measures the edge answer per crawler user agent.
- **Evidence narrowed on 2026-10-18.** An independent source review found the
  earlier grade text overstated: MCP does not require HTTPS for a site, RFC
  9116 names no AI consumer, the 2014 HTTPS ranking signal is not reaffirmed in
  Google's current page-experience documentation, and the ">95% of page loads"
  and "fastest-growing agent class" lines had no source. All were removed. The
  fail priority moved from `critical` to `high` for the reason under Scoring.
- The `warn` branch (HTTPS but no document) is not an HTTPS finding and
  overlaps reachability. It stays for now; moving it out is deferred.
