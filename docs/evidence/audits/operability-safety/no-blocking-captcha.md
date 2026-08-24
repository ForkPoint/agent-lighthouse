---
audit: operability-safety/no-blocking-captcha
audit_id: "5.18"
category: operability-safety
source_file: packages/core/src/audits/operability-safety/no-blocking-captcha.ts
slug: no-blocking-captcha
review_verdict: fix
severity: high
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# no-blocking-captcha (`5.18`)

> operability-safety · source `no-blocking-captcha.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

Blocking CAPTCHAs like reCAPTCHA and hCaptcha prevent AI agents from completing forms on behalf of users. When someone asks an AI assistant to "fill out the contact form on Example.com," the CAPTCHA blocks the action entirely. Use honeypot fields or invisible server-side validation instead.

## Code review findings (2026-08-20, 11-agent pass)

The concern is legitimate — interactive CAPTCHAs do stop agents — but detection is a substring scan of the entire HTML body with no form correlation and no distinction between blocking and invisible variants, so it flags sites that merely mention reCAPTCHA and contradicts its own remediation.

**Required fix:** Scope detection to actual script/widget inclusion — `script[src*="recaptcha/api.js"]`, `.g-recaptcha`, `.h-captcha`, `.cf-turnstile`, `[data-sitekey]` — via cheerio selectors rather than a body substring. Distinguish v3/invisible (render=explicit / size=invisible / score-based) from interactive v2 checkbox+challenge and only warn on the latter, matching the remediation. Correlate the widget with a form on the same page and report which form. Fold in `ctx.wafProtection.isBlocked` so edge challenges are reported rather than missed.

**False-positive risks:**
- `page.fetchResult.body.toLowerCase().includes(pattern)` scans the WHOLE document. A privacy policy containing 'This site is protected by reCAPTCHA and the Google Privacy Policy', a blog post about CAPTCHA alternatives, a CSP `<meta>` listing `https://challenges.cloudflare.com/turnstile`, or a commented-out script all trigger the warning. No `<script src>` requirement, no form proximity.
- No distinction between blocking and invisible. reCAPTCHA v3 and Enterprise score-based checks are transparent to agents, yet match the `recaptcha` substring — and `guidance.fix` explicitly recommends 'invisible reCAPTCHA v3 score-based checks'. A site that follows the remediation exactly still fails the audit. Self-contradictory advice.
- No correlation with forms at all. A CAPTCHA present only on /login while the contact form is CAPTCHA-free still warns that agents cannot submit forms.
- Conversely, false NEGATIVE: CAPTCHAs injected at runtime by a tag manager, or Cloudflare's interstitial/managed challenge served at the edge (which never appears in the scanned page's HTML because the scan was already blocked), are invisible to a body substring scan. `ctx.wafProtection` — which exists specifically to detect this — is unused.
- Every detection is a `warn` regardless of severity, so a fully blocking interactive hCaptcha on the only contact form scores identically to a passing mention in a footer link.

**Test gaps:**
- No fixture with 'protected by reCAPTCHA' in footer/privacy text (the most common false positive)
- No reCAPTCHA v3 vs v2 differentiation fixture
- No fixture where the CAPTCHA is on a different page than the form
- No `ctx.wafProtection` fixture (edge-level challenge)
- Only 3 tests total — the thinnest suite in the category for one of its riskiest heuristics

**Overlaps with:** `5.15`, `5.19`, `5.27`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Evidence (2026-08-21)

**Mechanism claim:** An interactive CAPTCHA gating a form (reCAPTCHA v2 checkbox/challenge, an hCaptcha visual challenge, or Cloudflare Turnstile in managed/interactive mode) stops an autonomous browsing agent from submitting that form on its own — the agent must hand control back to a human.

**Grade: A** — OpenAI's computer-use guide names "Solving CAPTCHA challenges" as an action the agent must not perform unattended, and the CAPTCHA vendors document that their interactive modes exist precisely to require a human response; the blocking path is documented consumer behavior, not inference.

**Evidence:**
- OpenAI's computer-use agent guide lists "Solving CAPTCHA challenges" among the actions that require explicit user confirmation immediately before execution, and treats bypassing a site's safety barrier as requiring full human takeover — https://developers.openai.com/api/docs/guides/tools-computer-use (verified 2026-08-21)
- hCaptcha states it "helps to protect your sites and apps from bots, spam, and other automated abuse" — its purpose is to deny non-human clients — https://docs.hcaptcha.com/ (verified 2026-08-21)
- reCAPTCHA v2 gates the `g-recaptcha-response` token on the user submitting a successful response; without that interaction there is no token to post with the form — https://developers.google.com/recaptcha/docs/display (verified 2026-08-21)
- Anthropic's browser use tool documents no CAPTCHA-handling path at all: it acts on the accessibility tree and screenshots and assumes it can reach the page — https://platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-tool (verified 2026-08-21)

**Counter-evidence:** The blocking property belongs to the *interactive* variants only, and every vendor documents a frictionless mode that agents pass without noticing. reCAPTCHA v3 "returns a score for each request without user friction" and "will never interrupt your users" (https://developers.google.com/recaptcha/docs/v3, verified 2026-08-21); Turnstile ships managed, non-interactive and invisible widget types and is marketed as a "CAPTCHA-free" alternative (https://developers.cloudflare.com/turnstile/, verified 2026-08-21); hCaptcha offers "nearly passive 'No-CAPTCHA' modes" (https://docs.hcaptcha.com/, verified 2026-08-21). The mechanism is therefore proven for the interactive case and false for the invisible case — which is exactly the distinction this audit's whole-body substring scan cannot make, and which its own remediation text recommends adopting.
