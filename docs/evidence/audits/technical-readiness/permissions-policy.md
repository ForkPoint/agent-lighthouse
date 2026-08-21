---
audit: technical-readiness/permissions-policy
audit_id: "8.6"
category: technical-readiness
source_file: packages/core/src/audits/technical-readiness/permissions-policy.ts
slug: permissions-policy
review_verdict: delete
severity: high
evidence_grade: D
disposition: "sunset (approved 2026-08-21)"
reviewed: 2026-08-21
---

# permissions-policy (`8.6`)

> technical-readiness · source `permissions-policy.ts` · review verdict **delete** · evidence grade **D** · disposition: **sunset (approved 2026-08-21)**

## What it checks

AI browser agents that visit your site may trigger permission prompts for camera, microphone, or geolocation if Permissions-Policy is not set. These prompts block agent workflows and are flagged as security concerns by AI trust-scoring systems.

## Code review findings (2026-08-20, 11-agent pass)

The mechanism claimed here is simply false. The audit fails sites without a `permissions-policy` header because 'AI browser agents that visit your site may trigger permission prompts for camera, microphone, or geolocation if Permissions-Policy is not set. These prompts block agent workflows.' Permission prompts are only ever raised when the page's own JavaScript calls `getUserMedia()`/`geolocation.getCurrentPosition()`; the absence of a Permissions-Policy header does not cause a prompt on any page, and headless/agentic browsers auto-deny by default. A site that never touches those APIs — the overwhelming majority — gets a 0.0 and a scary 'blocks automated agent workflows entirely' explanation for a non-existent problem. This is actively wrong guidance, not merely a weak signal.

**Required fix:** Delete. At most, keep Permissions-Policy as a zero-weight informational line inside the merged security-header hygiene audit, with the prompt-blocking claim removed entirely and replaced by the accurate 'restricts powerful-feature delegation to embedded third-party frames'.

**False-positive risks:**
- The premise never fires: no header ⇒ no prompt. Every static/content site on the web is failed for a condition that cannot occur on it.
- Presence-only: `if (value)` passes on `Permissions-Policy: camera=*, microphone=*, geolocation=*` — i.e. a policy that explicitly ALLOWS everything the guidance says to deny. Passing means nothing.
- Backwards for sites that legitimately use these APIs (video-call, map, AR products): they must NOT deny the feature, so the audit's recommended `camera=(), microphone=(), geolocation=()` would break their product, yet following the guidance is what the report tells them to do.
- Homepage-only; no-page guard yields a definite 'header is missing' fail on an empty scan (asserted by its own test).

**Test gaps:**
- No test for an all-permissive value (`camera=*`) — which currently passes.
- No test for a site that legitimately requires camera/geolocation, where the recommended fix is harmful.
- No test demonstrating any actual agent-blocking scenario the audit claims to prevent.
- No WAF/challenge test.

**Overlaps with:** `8.2`, `8.3`, `8.4`, `8.5`, `8.7`

## Evidence

### Signal: Security headers (HSTS, CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) as AI-readiness signals — grade D (technical-infra)

**Mechanism:** CLAIM UNDER TEST: the presence of HSTS / CSP / X-Content-Type-Options / Referrer-Policy / Permissions-Policy response headers changes whether or how an AI crawler or agent retrieves, parses, trusts or cites the page. FALSIFIABLE FORM: adding these headers measurably changes AI-crawler fetch behaviour or citation rate on otherwise identical content.

**Evidence:** No supporting evidence was found. An exhaustive read of the AI crawler documentation from OpenAI, Anthropic, Perplexity, Apple and Google turned up not a single reference to any of these headers. Google's AI-features guidance goes further and states there are 'no additional technical requirements' for AI Overviews / AI Mode beyond ordinary Search snippet eligibility. Cloudflare's AI Crawl Control — the product that actually sits between AI crawlers and origins — makes decisions on user agent, IP, signature and robots.txt, never on the origin's security headers.

**Counter-evidence:** These are browser-enforced defence-in-depth mechanisms with human users and browsers as their consumers; server-side crawlers do not implement any of them. The only genuine adjacencies, and they run in the OPPOSITE direction from the audit: (1) CSP frame-ancestors / X-Frame-Options can PREVENT a page being embedded in an agent surface, so a strict policy is an agent-readiness negative, not a positive; (2) OpenAI's Apps SDK shows CSP being imposed BY the agent host on its own widget iframe (connect_domains → connect-src, frameDomains for nested frames), which is a property of the app, not of the publisher's site; (3) X-Content-Type-Options: nosniff only matters in a browser and only makes a wrong Content-Type more fatal — it belongs to the content-type signal, not here. Recommend removing these from any AI-readiness SCORE. They remain legitimate general web-security hygiene and can be reported as unscored context, but presenting them as AI-agent signals is not defensible and would be the easiest finding for a critic to falsify.
**Consumers:** none-known · **Recommended tier:** delete

**Sources:** [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) · [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) · [Perplexity Crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers) · [AI features and your website — Google Search Central](https://developers.google.com/search/docs/appearance/ai-features) · [AI Crawl Control overview](https://developers.cloudflare.com/ai-crawl-control/) · [Security & Privacy — Apps SDK](https://developers.openai.com/apps-sdk/guides/security-privacy)

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/sunset/technical-readiness/permissions-policy.md](../../sunset/technical-readiness/permissions-policy.md). Outcome: **dead**, grade D.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
