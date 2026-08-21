---
audit: crawler-permissions/no-bot-detection
audit_id: "2.26"
category: crawler-permissions
source_file: packages/core/src/audits/crawler-permissions/no-bot-detection.ts
slug: no-bot-detection
review_verdict: fix
severity: high
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# no-bot-detection (`2.26`)

> crawler-permissions · source `no-bot-detection.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

Bot-detection services like Cloudflare Turnstile, DataDome, and reCAPTCHA can block legitimate AI agents from accessing your content. Configure your service to allowlist known AI user-agents.

## Code review findings (2026-08-20, 11-agent pass)

Two audits in one file with opposite quality. The WAF branch (`ctx.wafProtection?.isBlocked`) is the most valuable check in the entire category — it observes actual blocking behavior rather than declared intent — and should be kept. The page-scan branch below it is a substring hunt that fires constantly on healthy sites: `html.includes('recaptcha')` flags any page whose contact form, comment box or newsletter signup uses reCAPTCHA, even though a form widget does not impede crawler access to the page at all. The logic is self-refuting: the page is in `ctx.pages` only because the scanner successfully fetched and parsed it, which is direct evidence it was not blocked, yet the audit issues a high-priority warning that agents may be unable to access it. Worse, the audit is structurally unable to detect the dominant real-world mechanism — since 2024, sites block AI by user-agent at the edge (Cloudflare's one-click AI-scraper toggle), and the scanner fetches everything as `AgentLighthouse/1.0`, so such a site scans clean and PASSes while GPTBot receives a 403.

**Required fix:** Replace the page-scan branch with an active UA probe: refetch the homepage (and one interior page) as `GPTBot`, `ChatGPT-User`, `ClaudeBot` and `PerplexityBot`, and FAIL on status divergence or a large body-length delta versus the baseline `AgentLighthouse` fetch. That measures the real behavior. Demote script-presence detection to informational, and require the pattern to appear in a `<script src>` attribute rather than anywhere in the body — and only warn when the widget gates the main content (e.g. body text below a plausibility threshold), not when a form uses it. Align the pattern list with `waf-detector.ts`. Add tests for the `wafProtection` branch.

**False-positive risks:**
- `html.includes('recaptcha')` matches the literal word anywhere in the document: a GDPR cookie-consent vendor table listing 'Google reCAPTCHA', a privacy policy paragraph naming it, a CSP header echoed into the page, or an analytics blocklist. Prose about reCAPTCHA triggers a high-priority warning. Extremely common on EU sites.
- A reCAPTCHA or Turnstile widget scoped to a single form is treated as site-wide agent blocking; the page it sits on is fully readable and was in fact read.
- `'datadome.co'` is a bare substring and also matches `datadome.com` and any URL containing that sequence.
- `'challenges.cloudflare.com'` matches Turnstile used purely for form spam protection, which never challenges a crawler fetching HTML.
- Cannot observe UA-based edge blocking — the single most common way AI agents are actually blocked in 2026 — because every request uses `SCANNER_USER_AGENT`. Clean PASS on a site where GPTBot is 403'd.
- The page-scan pattern list (4 entries) is inconsistent with `waf-detector.ts`, which knows Akamai, PerimeterX/HUMAN, Imperva, Kasada and AWS WAF; the two branches of the same audit disagree about what counts as bot defense.
- `page.fetchResult.body` is lowercased per page with no length guard, so the check runs over the full 5MB-capped body including inline scripts and JSON blobs.

**Test gaps:**
- No test with reCAPTCHA mentioned in prose (privacy policy / cookie banner vendor list) — the highest-frequency false positive.
- No test with a captcha scoped to a single form on an otherwise fully-readable page.
- No test of the `ctx.wafProtection.isBlocked` branch at all — the audit's most valuable path is entirely uncovered by the suite.
- No test for Akamai/PerimeterX/Kasada/Imperva, which the WAF detector knows and the page scan does not.
- No UA-probe scenario (site returns 200 to the scanner, 403 to GPTBot).
- No `datadome.com` near-miss case.

**Overlaps with:** _none_

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
