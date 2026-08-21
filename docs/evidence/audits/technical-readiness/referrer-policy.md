---
audit: technical-readiness/referrer-policy
audit_id: "8.5"
category: technical-readiness
source_file: packages/core/src/audits/technical-readiness/referrer-policy.ts
slug: referrer-policy
review_verdict: delete
severity: medium
evidence_grade: D
disposition: "sunset (approved 2026-08-21)"
reviewed: 2026-08-21
---

# referrer-policy (`8.5`)

> technical-readiness · source `referrer-policy.ts` · review verdict **delete** · evidence grade **D** · disposition: **sunset (approved 2026-08-21)**

## What it checks

AI trust-scoring systems check for Referrer-Policy as a privacy maturity signal. Without it, your site leaks full URL paths in referrer headers to third parties, which AI security audits flag as a privacy concern that can reduce trust scores.

## Code review findings (2026-08-20, 11-agent pass)

Presence-only check for a `referrer-policy` header, failing sites that lack it on the grounds that 'AI trust-scoring systems check for Referrer-Policy as a privacy maturity signal'. That is invented — no AI crawler or answer engine reads this header. The check is also largely moot on the modern web: since 2020-21 all major browsers default to `strict-origin-when-cross-origin`, which is precisely the value the audit's own `guidance.code` recommends. So a site with no header already behaves the way the audit asks, and is nonetheless scored 0.0. Nothing about passing this audit changes any AI agent outcome.

**Required fix:** Delete. If the maintainer wants to retain any security-header reporting, fold presence/value of Referrer-Policy into the single merged hygiene audit proposed for 8.2/8.3/8.4/8.6 as an informative line item with no score impact — and, if kept, at least reject `unsafe-url` and read `<meta name="referrer">`.

**False-positive risks:**
- Failing the browser-default behavior: absent header ⇒ browsers apply `strict-origin-when-cross-origin` ⇒ the audit's stated harm ('leaks full URL paths including query parameters') does not occur, yet the site scores 0.0.
- Presence-only: `if (value)` passes on `Referrer-Policy: unsafe-url`, the single most leaky value possible and the exact opposite of what the guidance asks for. Passing is not evidence of anything.
- `<meta name="referrer">` (the HTML delivery form, still common on CMS templates) is not read at all.
- Homepage-only; no-page guard produces a confident 'missing' fail on a scan that fetched nothing (its own test asserts this).

**Test gaps:**
- No test for `unsafe-url` (should not pass).
- No test for `<meta name="referrer" content="…">`.
- No test asserting the audit's premise against modern browser defaults.
- No WAF/challenge test.

**Overlaps with:** `8.2`, `8.3`, `8.4`, `8.6`, `8.7`

## Evidence

### Signal: Security headers (HSTS, CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) as AI-readiness signals — grade D (technical-infra)

**Mechanism:** CLAIM UNDER TEST: the presence of HSTS / CSP / X-Content-Type-Options / Referrer-Policy / Permissions-Policy response headers changes whether or how an AI crawler or agent retrieves, parses, trusts or cites the page. FALSIFIABLE FORM: adding these headers measurably changes AI-crawler fetch behaviour or citation rate on otherwise identical content.

**Evidence:** No supporting evidence was found. An exhaustive read of the AI crawler documentation from OpenAI, Anthropic, Perplexity, Apple and Google turned up not a single reference to any of these headers. Google's AI-features guidance goes further and states there are 'no additional technical requirements' for AI Overviews / AI Mode beyond ordinary Search snippet eligibility. Cloudflare's AI Crawl Control — the product that actually sits between AI crawlers and origins — makes decisions on user agent, IP, signature and robots.txt, never on the origin's security headers.

**Counter-evidence:** These are browser-enforced defence-in-depth mechanisms with human users and browsers as their consumers; server-side crawlers do not implement any of them. The only genuine adjacencies, and they run in the OPPOSITE direction from the audit: (1) CSP frame-ancestors / X-Frame-Options can PREVENT a page being embedded in an agent surface, so a strict policy is an agent-readiness negative, not a positive; (2) OpenAI's Apps SDK shows CSP being imposed BY the agent host on its own widget iframe (connect_domains → connect-src, frameDomains for nested frames), which is a property of the app, not of the publisher's site; (3) X-Content-Type-Options: nosniff only matters in a browser and only makes a wrong Content-Type more fatal — it belongs to the content-type signal, not here. Recommend removing these from any AI-readiness SCORE. They remain legitimate general web-security hygiene and can be reported as unscored context, but presenting them as AI-agent signals is not defensible and would be the easiest finding for a critic to falsify.
**Consumers:** none-known · **Recommended tier:** delete

**Sources:** [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) · [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) · [Perplexity Crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers) · [AI features and your website — Google Search Central](https://developers.google.com/search/docs/appearance/ai-features) · [AI Crawl Control overview](https://developers.cloudflare.com/ai-crawl-control/) · [Security & Privacy — Apps SDK](https://developers.openai.com/apps-sdk/guides/security-privacy)

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/technical-readiness/referrer-policy.md](../../deletions/technical-readiness/referrer-policy.md). Outcome: **dead**, grade D.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
