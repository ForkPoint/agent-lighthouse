---
audit: technical-readiness/hsts-header
audit_id: "8.2"
category: technical-readiness
source_file: packages/core/src/audits/technical-readiness/hsts-header.ts
slug: hsts-header
review_verdict: merge
severity: medium
evidence_grade: B
disposition: "proposed: merge (pending triage)"
reviewed: 2026-08-21
---

# hsts-header (`8.2`)

> technical-readiness · source `hsts-header.ts` · review verdict **merge** · evidence grade **B** · disposition: **proposed: merge (pending triage)**

## What it checks

AI agents that follow redirects from HTTP to HTTPS waste time on the redirect hop and may be blocked by strict security policies that reject non-HSTS sites. HSTS ensures agents always connect over HTTPS on the first request, improving crawl efficiency and trust scoring.

## Code review findings (2026-08-20, 11-agent pass)

Presence-only check for `strict-transport-security` on the homepage response. The detection is correct but trivial; the problem is the guidance. HSTS is a browser-enforced mechanism — the AI crawlers the audit names (GPTBot, ClaudeBot) are HTTP clients that do not maintain HSTS state or consult the preload list, and no 'enterprise RAG pipeline rejects non-HSTS sites'. The claimed impact ('wasting a round-trip on every new connection', 'blocking your content from enterprise RAG pipelines and AI-powered procurement tools') is fabricated, yet it is scored `fail` at priority `high` — the second-highest priority tier — for a header with no measurable AI effect. Redundant with the rest of the security-header cluster.

**Required fix:** Merge into a single low-weight 'security header hygiene' audit alongside 8.3/8.4/8.5/8.6 that reports presence as informative sub-items and never fails the site. If kept standalone: parse the directive (require `max-age >= 31536000`, reject `max-age=0`), drop priority to `low`, return `na` when there is no page or the scan was WAF-blocked, and rewrite impact copy to 'general transport-security hygiene — no direct effect on AI crawler access', removing the GPTBot/ClaudeBot/RAG claims.

**False-positive risks:**
- Presence-only, value ignored: `if (hsts)` passes on `max-age=0` — the value that explicitly DISABLES HSTS. A site actively rolling HSTS back scores a full 1.0.
- Homepage-only and apex-only: many CDN configs attach HSTS at the edge for the canonical host but not for the www/apex variant the user scanned; scanning the other hostname flips the result with no change to the site.
- No `page` guard: with `ctx.pages` empty (total fetch failure, WAF drop) `headers ?? {}` yields no header and the audit reports a definite 'header is missing' fail rather than 'could not measure' — its own test asserts this wrong behavior ('fails when there are no pages').
- Response-code sensitivity: some servers emit HSTS only on 2xx and omit it on the 301 that the scanner's redirect follow lands on first; because `finalUrl` is unreliable it is not visible which response was actually measured.

**Test gaps:**
- No test for `max-age=0` (should not pass).
- No test for a malformed/short max-age (e.g. `max-age=300`, far below the one-year value the guidance demands).
- No test for a WAF/challenge response.
- No test that the header is checked on the post-redirect response rather than an intermediate hop.

**Overlaps with:** `8.3`, `8.4`, `8.5`, `8.6`, `8.7`

## Evidence

### Signal: HTTPS requirement (TLS, valid certificate, HTTP→HTTPS redirect) — grade B (technical-infra)

**Mechanism:** Serving the site over HTTPS with a valid certificate is a precondition for AI-agent surfaces to retrieve or act on the site: agent-protocol specs mandate HTTPS outright, well-known agent/security files are defined as HTTPS-only, and browser-based agents inherit Chromium's mixed-content and HTTPS-First behaviour. FALSIFIABLE FORM: an equivalent page served only over plaintext HTTP is retrieved and used less often by AI agents than the same page over HTTPS.

**Evidence:** Strongest evidence is from agent-adjacent ratified/near-ratified specs rather than crawler docs. MCP (2025-11-25) states plainly: 'All authorization server endpoints MUST be served over HTTPS' and 'All redirect URIs MUST be either localhost or use HTTPS', with Client ID Metadata Documents required at HTTPS URLs — so any MCP-exposed site capability is unreachable without TLS. RFC 9116 requires security.txt to be 'accessed exclusively via HTTPS'. Browser-resident agents (ChatGPT Atlas, Comet, Gemini-in-Chrome, Claude in Chrome) run on Chromium and therefore inherit mixed-content blocking and HTTPS-First warnings, so an HTTP-only page degrades for the fastest-growing agent class. Google's AI-features eligibility runs through normal Search indexing, where HTTPS has been a documented positive signal since 2014.

**Counter-evidence:** No AI crawler vendor documents HTTPS as a requirement. developers.openai.com/api/docs/bots, Anthropic's crawler support article and docs.perplexity.ai all say nothing about TLS; GPTBot, ClaudeBot and PerplexityBot are ordinary HTTP clients and will fetch http:// URLs. So the strict claim 'AI crawlers refuse HTTP' is UNPROVEN and should not be asserted. The honest claim is narrower: HTTPS is mandatory for agent protocols and browser-based agents, and is a universal baseline (>95% of page loads) such that its absence is a strong negative quality signal. HSTS specifically has no documented AI consumer at all — see the security-headers signal.
**Consumers:** MCP clients (Claude, ChatGPT, VS Code, Cursor), ChatGPT Atlas, Perplexity Comet, Gemini in Chrome, Claude in Chrome, security.txt tooling · **Recommended tier:** scored

**Sources:** [Model Context Protocol Specification (2025-11-25) — Authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization) · [RFC 9116 — A File Format to Aid in Security Vulnerability Disclosure](https://www.rfc-editor.org/rfc/rfc9116.html) · [AI features and your website — Google Search Central](https://developers.google.com/search/docs/appearance/ai-features) · [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) · [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) · [Perplexity Crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)

### Signal: Security headers (HSTS, CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) as AI-readiness signals — grade D (technical-infra)

**Mechanism:** CLAIM UNDER TEST: the presence of HSTS / CSP / X-Content-Type-Options / Referrer-Policy / Permissions-Policy response headers changes whether or how an AI crawler or agent retrieves, parses, trusts or cites the page. FALSIFIABLE FORM: adding these headers measurably changes AI-crawler fetch behaviour or citation rate on otherwise identical content.

**Evidence:** No supporting evidence was found. An exhaustive read of the AI crawler documentation from OpenAI, Anthropic, Perplexity, Apple and Google turned up not a single reference to any of these headers. Google's AI-features guidance goes further and states there are 'no additional technical requirements' for AI Overviews / AI Mode beyond ordinary Search snippet eligibility. Cloudflare's AI Crawl Control — the product that actually sits between AI crawlers and origins — makes decisions on user agent, IP, signature and robots.txt, never on the origin's security headers.

**Counter-evidence:** These are browser-enforced defence-in-depth mechanisms with human users and browsers as their consumers; server-side crawlers do not implement any of them. The only genuine adjacencies, and they run in the OPPOSITE direction from the audit: (1) CSP frame-ancestors / X-Frame-Options can PREVENT a page being embedded in an agent surface, so a strict policy is an agent-readiness negative, not a positive; (2) OpenAI's Apps SDK shows CSP being imposed BY the agent host on its own widget iframe (connect_domains → connect-src, frameDomains for nested frames), which is a property of the app, not of the publisher's site; (3) X-Content-Type-Options: nosniff only matters in a browser and only makes a wrong Content-Type more fatal — it belongs to the content-type signal, not here. Recommend removing these from any AI-readiness SCORE. They remain legitimate general web-security hygiene and can be reported as unscored context, but presenting them as AI-agent signals is not defensible and would be the easiest finding for a critic to falsify.
**Consumers:** none-known · **Recommended tier:** delete

**Sources:** [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) · [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) · [Perplexity Crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers) · [AI features and your website — Google Search Central](https://developers.google.com/search/docs/appearance/ai-features) · [AI Crawl Control overview](https://developers.cloudflare.com/ai-crawl-control/) · [Security & Privacy — Apps SDK](https://developers.openai.com/apps-sdk/guides/security-privacy)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
