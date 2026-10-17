---
audit: access-crawl-control/https-enabled
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/https-enabled.ts
slug: https-enabled
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: scored
consumers:
  - Cloudflare AI Crawl Control / Bot Management
  - site-operator WAF rules
  - GPTBot
  - ClaudeBot
  - PerplexityBot (as blocked parties)
signals:
  - name: "HTTPS requirement (TLS, valid certificate, HTTP→HTTPS redirect)"
    grade: B
    domain: technical-infra
  - name: "WAF / bot-management blocking AI agents (Cloudflare AI Crawl Control, default blocks, pay-per-crawl 402)"
    grade: A
    domain: technical-infra
sources:
  - mcp-spec-authorization
  - rfc9116
  - google-ai-features-trust
  - s18
  - anthropic-crawlers
  - perplexity-crawlers-docs
  - s21
  - cloudflare-pay-per-crawl
  - cloudflare-content-independence-day
  - cloudflare-ai-options-2026
  - cloudflare-googlebot-to-gptbot-2025
  - cloudflare-perplexity-stealth-crawlers
  - cloudflare-web-bot-auth
  - cloudflare-crawl-refer-ratio
  - s2
---

# https-enabled (`8.1`)

> technical-readiness · source `https-enabled.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Enterprise AI frameworks refuse to interact with non-HTTPS sites due to security policies. GPTBot, ClaudeBot, and enterprise RAG systems all skip HTTP-only sites entirely, making your content invisible to AI-generated answers. Enable HTTPS with a valid TLS certificate.

## Evidence

### Signal: HTTPS requirement (TLS, valid certificate, HTTP→HTTPS redirect) — grade B (technical-infra)

**Mechanism:** Serving the site over HTTPS with a valid certificate is a precondition for AI-agent surfaces to retrieve or act on the site. Agent-protocol specs mandate HTTPS outright. Well-known agent and security files are defined as HTTPS-only. Browser-based agents inherit Chromium's mixed-content and HTTPS-First behaviour. Falsifiable form: an equivalent page served only over plaintext HTTP is retrieved and used less often by AI agents than the same page over HTTPS.

**Grade: B** — The evidence is strong but it comes from agent-adjacent specifications rather than from crawler documentation. MCP states that "All authorization server endpoints MUST be served over HTTPS". The well-known agent and security files are defined HTTPS-only. Browser-based agents inherit Chromium's mixed-content and HTTPS-First behaviour. An agent surface that requires HTTPS genuinely cannot be reached without it. What is missing for an A is a crawler vendor saying so: OpenAI's, Anthropic's and Perplexity's crawler documents say nothing about TLS, and their crawlers are ordinary HTTP clients that will fetch `http://` URLs. The strict claim "AI crawlers refuse HTTP" is unproven, and the audit does not make it.

**Evidence:** Strongest evidence is from agent-adjacent ratified/near-ratified specs rather than crawler docs. MCP (2025-11-25) states plainly: 'All authorization server endpoints MUST be served over HTTPS', and 'All redirect URIs MUST be either localhost or use HTTPS'. Client ID Metadata Documents are required at HTTPS URLs. Any MCP-exposed site capability is therefore unreachable without TLS. RFC 9116 requires security.txt to be 'accessed exclusively via HTTPS'. Browser-resident agents (ChatGPT Atlas, Comet, Gemini-in-Chrome, Claude in Chrome) run on Chromium and therefore inherit mixed-content blocking and HTTPS-First warnings, so an HTTP-only page degrades for the fastest-growing agent class. Google's AI-features eligibility runs through normal Search indexing, where HTTPS has been a documented positive signal since 2014.

**Counter-evidence:** No AI crawler vendor documents HTTPS as a requirement. developers.openai.com/api/docs/bots, Anthropic's crawler support article and docs.perplexity.ai all say nothing about TLS; GPTBot, ClaudeBot and PerplexityBot are ordinary HTTP clients and will fetch http:// URLs. So the strict claim 'AI crawlers refuse HTTP' is unproven and should not be asserted. The honest claim is narrower: HTTPS is mandatory for agent protocols and browser-based agents, and is a universal baseline (>95% of page loads) such that its absence is a strong negative quality signal. HSTS specifically has no documented AI consumer at all — see the security-headers signal.

### Signal: WAF / bot-management blocking AI agents (Cloudflare AI Crawl Control, default blocks, pay-per-crawl 402) — grade A (technical-infra)

**Mechanism:** Edge bot-management sitting in front of the origin can deny AI crawlers and agents outright, or gate them behind payment, so a site with perfect content structure can still be entirely invisible to AI systems. Falsifiable form: fetch the same URL with an AI-crawler User-Agent versus a browser User-Agent; divergent status codes (403 / 401 / 402 / challenge page for the former) prove an access gate independent of content quality.

**Grade: A** — Cloudflare documents the behaviour at scale and by date. It began blocking AI crawlers by default for new domains on 1 July 2025. It has announced that from 15 September 2026, new domains on ad-displaying plans will block Training and Agent class bots by default. That is a named intermediary documenting exactly what it does to the traffic this audit is about, which is grade A. Two caveats shape how it can be measured, rather than whether it is true. User-agent probing is unreliable in both directions: Perplexity was documented using a Chrome-impersonating stealth crawler, and scrapers routinely spoof GPTBot. An opaque block therefore cannot be told apart from correct impersonation defence.

**Evidence:** Fully documented vendor behaviour at large scale. Cloudflare began blocking AI crawlers by default for new domains on 1 July 2025, making permission the default posture across a very large share of the web. It has since announced that from 15 September 2026 new domains will block 'Training' and 'Agent' class bots by default on ad-displaying pages while leaving 'Search' allowed, and has extended managed robots.txt with a `use` signal (immediate / reference / full). Pay-per-crawl operationalises the gate in HTTP. Crawlers 'either present payment intent via request headers for successful HTTP 200 access, or receive an HTTP 402 Payment Required response with pricing', at a minimum of $0.001 per crawl. Critically, an existing WAF or Bot Management block rule overrides pay-per-crawl's charge behaviour, and silently converts a monetizable crawl into a hard block. Adoption context: of 3,816 top-10k domains with robots.txt, ~14% carried AI-bot directives; GPTBot was the most-disallowed at 312 domains. Verification is moving to cryptography — Cloudflare's Web Bot Auth implements RFC 9421 HTTP Message Signatures with Signature-Input / Signature / Signature-Agent headers and a JWKS key directory at /.well-known/http-message-signatures-directory.

**Counter-evidence:** Two caveats that shape how this must be audited. (1) User-Agent-based probing is unreliable in both directions: Cloudflare documented Perplexity using a Chrome-impersonating stealth crawler on unlisted IPs across rotating ASNs at 3–6M requests/day to evade no-crawl directives, and conversely malicious scrapers routinely spoof GPTBot. An audit that merely sets a UA header measures the WAF's UA rules, not real agent access — genuine verification requires the vendors' published IP ranges (openai.com/gptbot.json, claude.com/crawling/bots.json, perplexity.com/perplexitybot.json) or Web Bot Auth signatures. (2) Blocking is often a deliberate, rational business decision, not a defect. Cloudflare's crawl-to-refer data puts Anthropic at about 71,000 crawls per HTML referral in the June 2025 window, with the caveat that Claude's native app sends no Referer. That makes uncompensated crawl a real cost. The audit should REPORT the gate neutrally as 'AI agents are blocked here' rather than scoring it as a failure, since the site owner may have chosen it.

## Implementation deviations

- The plain-HTTP fail needs no response. The scheme is a property of the request, so the audit declares no `requires` keys and a walled HTTP site still fails.
- With no homepage document, the audit warns that the response carried no document. It does not name a status: `origin-reachable` accepts any 2xx, and the audit holds no homepage `FetchResult` on that branch.
- Plumbing the homepage status onto `CheckContext` was considered and not done. Every caller that builds a context would carry a field one branch of one audit reads.
