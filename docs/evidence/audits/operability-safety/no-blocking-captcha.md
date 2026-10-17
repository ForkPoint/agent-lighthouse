---
audit: operability-safety/no-blocking-captcha
category: operability-safety
source_file: packages/core/src/audits/operability-safety/no-blocking-captcha.ts
slug: no-blocking-captcha
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - openai-computer-use-guide
  - hcaptcha-docs
  - google-recaptcha-display
  - anthropic-browser-use-tool
---

# no-blocking-captcha (`5.18`)

> operability-safety · source `no-blocking-captcha.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

Blocking CAPTCHAs like reCAPTCHA and hCaptcha prevent AI agents from completing forms on behalf of users. When someone asks an AI assistant to "fill out the contact form on Example.com," the CAPTCHA blocks the action entirely. Use honeypot fields or invisible server-side validation instead.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Implementation deviations

- A WAF block on the scan that is not a rate limit fails the audit and names the provider. A rate limit is the scan asking too fast, so it is excluded.
- `requires` is empty. Being walled is the subject, and a 403 denies `origin-reachable`, so gating on it would hide the wall finding.
- A scan with no fetched page returns `notApplicable`.
- When nothing is detected on a page that served no readable text, the audit returns `notApplicable`. A JS shell renders both the widget and the form it guards.
- Detection reads widget markup, not body text: a vendor loader `<script src>` or the mount element (`.g-recaptcha`, `.h-captcha`, `.cf-turnstile`). Prose, config and CSP text do not match.

## Deferred

- Interactive versus invisible variants. reCAPTCHA v3, Turnstile's managed and invisible modes and hCaptcha's passive mode do not stop an agent. The markup does not say which mode runs, so every detected widget warns.
- Form correlation. The finding names the page, not the form the widget guards.

## Evidence (2026-08-21)

**Mechanism claim:** An interactive CAPTCHA can gate a form: a reCAPTCHA v2 checkbox or challenge, an hCaptcha visual challenge, or Cloudflare Turnstile in managed or interactive mode. It stops an autonomous browsing agent from submitting that form on its own. The agent must hand control back to a human.

**Grade: A** — OpenAI's computer-use guide names "Solving CAPTCHA challenges" as an action the agent must not perform unattended. The CAPTCHA vendors document that their interactive modes exist precisely to require a human response. The blocking path is documented consumer behavior, not inference.

**Evidence:**

- OpenAI's computer-use agent guide lists "Solving CAPTCHA challenges" among the actions that require explicit user confirmation immediately before execution, and treats bypassing a site's safety barrier as requiring full human takeover — https://developers.openai.com/api/docs/guides/tools-computer-use (verified 2026-08-21)
- hCaptcha states it "helps to protect your sites and apps from bots, spam, and other automated abuse" — its purpose is to deny non-human clients — https://docs.hcaptcha.com/ (verified 2026-08-21)
- reCAPTCHA v2 gates the `g-recaptcha-response` token on the user submitting a successful response; without that interaction there is no token to post with the form — https://developers.google.com/recaptcha/docs/display (verified 2026-08-21)
- Anthropic's browser use tool documents no CAPTCHA-handling path at all: it acts on the accessibility tree and screenshots and assumes it can reach the page — https://platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-tool (verified 2026-08-21)

**Counter-evidence:** The blocking property belongs to the _interactive_ variants only. Every vendor documents a frictionless mode that agents pass without noticing. reCAPTCHA v3 "returns a score for each request without user friction", and "will never interrupt your users" (https://developers.google.com/recaptcha/docs/v3, verified 2026-08-21). Turnstile ships managed, non-interactive and invisible widget types, and is marketed as a "CAPTCHA-free" alternative (https://developers.cloudflare.com/turnstile/, verified 2026-08-21). hCaptcha offers "nearly passive 'No-CAPTCHA' modes" (https://docs.hcaptcha.com/, verified 2026-08-21). The mechanism is therefore proven for the interactive case and false for the invisible case — which is exactly the distinction this audit's whole-body substring scan cannot make, and which its own remediation text recommends adopting.
