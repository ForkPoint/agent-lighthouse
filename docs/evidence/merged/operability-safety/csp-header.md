---
audit: operability-safety/csp-header
audit_id: "8.3"
category: operability-safety
source_file: packages/core/src/audits/operability-safety/csp-header.ts
slug: csp-header
review_verdict: fix
severity: high
evidence_grade: D
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# csp-header (`8.3`)

> operability-safety · source `csp-header.ts` · review verdict **fix** · evidence grade **D** · disposition: **keep — fix required**

## What it checks

AI trust-scoring systems check for CSP headers as a signal of site security maturity. Sites without CSP are flagged as potentially compromised, which can reduce your content's trust score in AI-generated recommendations. CSP also prevents injected scripts from altering the content AI agents crawl.

## Code review findings (2026-08-20, 11-agent pass)

Fails any site lacking a `content-security-policy` response header, at priority `high`, on the stated grounds that 'AI trust-scoring systems check for CSP headers as a signal of site security maturity' and 'sites without CSP are flagged as potentially compromised'. No such system exists — this is the clearest cargo-cult claim in the category. Compounding it, the check is presence-only and header-only: a wide-open `default-src *; script-src 'unsafe-inline' 'unsafe-eval'` scores 1.0 while a properly locked-down policy delivered via `<meta http-equiv>` scores 0.0. So it is simultaneously falsy in motivation and wrong in detection.

**Required fix:** Read `<meta http-equiv="Content-Security-Policy">` from `page.$` in addition to the header, and accept `content-security-policy-report-only` as a partial (warn, not fail). Grade the policy rather than its presence — at minimum flag `unsafe-inline`/`unsafe-eval`/`default-src *` as not-a-pass. Then downgrade the whole audit to `low` priority / informational and delete the 'AI trust-scoring systems flag sites without CSP' and 'poisoning AI knowledge bases' copy from both `description` and the inline `description` in the fail branch; state honestly that CSP is site-security hygiene with no bearing on AI crawler access.

**False-positive risks:**
- Meta-tag CSP ignored: only `headers['content-security-policy']` is read. Static hosts (GitHub Pages, plain S3, many Jamstack setups) that cannot set arbitrary response headers ship CSP as `<meta http-equiv="Content-Security-Policy" content="…">` — a fully valid delivery method — and are failed.
- Report-Only ignored: a site mid-rollout serving `content-security-policy-report-only` is failed as having no CSP at all.
- Presence-only: `if (csp)` passes on `default-src *` or on a single meaningless directive, so passing this audit is not evidence of any security posture.
- Homepage-only: CSP is frequently set per-route (strict on app routes, absent on the marketing homepage) — the audit reads the least-representative page.
- No page guard: empty `ctx.pages` yields a confident 'header is missing' fail (its own test locks this in).

**Test gaps:**
- No test for `<meta http-equiv="Content-Security-Policy">`.
- No test for `content-security-policy-report-only`.
- No test asserting a permissive policy (`default-src *`) is not treated as equivalent to a strict one.
- No multi-page test where CSP is present on one route and absent on another.
- No WAF/challenge-response test.

**Overlaps with:** `8.2`, `8.4`, `8.5`, `8.6`, `8.7`

## Evidence

### Signal: Security headers (HSTS, CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) as AI-readiness signals — grade D (technical-infra)

**Mechanism:** CLAIM UNDER TEST: the presence of HSTS / CSP / X-Content-Type-Options / Referrer-Policy / Permissions-Policy response headers changes whether or how an AI crawler or agent retrieves, parses, trusts or cites the page. FALSIFIABLE FORM: adding these headers measurably changes AI-crawler fetch behaviour or citation rate on otherwise identical content.

**Evidence:** No supporting evidence was found. An exhaustive read of the AI crawler documentation from OpenAI, Anthropic, Perplexity, Apple and Google turned up not a single reference to any of these headers. Google's AI-features guidance goes further and states there are 'no additional technical requirements' for AI Overviews / AI Mode beyond ordinary Search snippet eligibility. Cloudflare's AI Crawl Control — the product that actually sits between AI crawlers and origins — makes decisions on user agent, IP, signature and robots.txt, never on the origin's security headers.

**Counter-evidence:** These are browser-enforced defence-in-depth mechanisms with human users and browsers as their consumers; server-side crawlers do not implement any of them. The only genuine adjacencies, and they run in the OPPOSITE direction from the audit: (1) CSP frame-ancestors / X-Frame-Options can PREVENT a page being embedded in an agent surface, so a strict policy is an agent-readiness negative, not a positive; (2) OpenAI's Apps SDK shows CSP being imposed BY the agent host on its own widget iframe (connect_domains → connect-src, frameDomains for nested frames), which is a property of the app, not of the publisher's site; (3) X-Content-Type-Options: nosniff only matters in a browser and only makes a wrong Content-Type more fatal — it belongs to the content-type signal, not here. Recommend removing these from any AI-readiness SCORE. They remain legitimate general web-security hygiene and can be reported as unscored context, but presenting them as AI-agent signals is not defensible and would be the easiest finding for a critic to falsify.
**Consumers:** none-known · **Recommended tier:** delete

**Sources:** [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) · [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) · [Perplexity Crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers) · [AI features and your website — Google Search Central](https://developers.google.com/search/docs/appearance/ai-features) · [AI Crawl Control overview](https://developers.cloudflare.com/ai-crawl-control/) · [Security & Privacy — Apps SDK](https://developers.openai.com/apps-sdk/guides/security-privacy)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

**Merged into:** `operability-safety/security-header-hygiene` (Plan 4, 2026-08-22) — [merged dossier](../../audits/operability-safety/security-header-hygiene.md)
