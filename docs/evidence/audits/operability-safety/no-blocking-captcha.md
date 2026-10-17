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

- 2026-08-26 — the audit now reports the wall the scanner itself met. It looked
  for CAPTCHA markup in the scanned pages, so a site that refused the scan
  outright produced no pages, no matches, and a pass — the audit congratulated
  the site that had just blocked it. When the scan carries a WAF block that is
  not a rate limit, the audit fails and names the provider. A rate limit is
  excluded: that is the scan asking too fast, not the site walling agents off.
- 2026-08-26 — a scan with no fetched page returns `notApplicable` instead of
  passing. No page means no form was inspected.
- 2026-08-26 — the audit is exempt from the scan evidence gate. Being walled is
  its subject, so gating it on the evidence a wall destroys would delete the
  finding.
- 2026-08-28 — the audit declines when the scan holds no response it can
  attribute to this site. It read the CAPTCHA markup on the scanned pages, and
  `ctx.pages`/`ctx.rootFiles` carry whatever answered 200 — on a parked domain
  a broker's page from another host, on a walled or throttled origin nothing
  at all. It now consults `scanReadTheSite()` and returns `notApplicable`
  carrying the gate's own reason.
  The guard sits **below** the bot-wall branch, so a walled scan still fails
  and names the wall. `requires` is now empty and the gate exemption drops
  `origin-reachable`: a 403 denies that key, so the wall finding added on
  2026-08-26 had been unreachable in production for the 403 that produces it.
  Verdicts that moved on the five nothing-obtained contract states: redirected
  away pass → na, non-HTML homepage pass → na, HTTP 200 bot challenge
  unchanged. Found by
  `packages/core/src/tests/hostile-state-contract.test.ts`.
- 2026-08-28 — the "found nothing" branch declines a page that served no
  readable text. The detection is a substring search over the served HTML, and
  a JS shell serves a mount point and a bundle: the CAPTCHA an agent meets is
  rendered by that bundle, and so is the form it guards. Before this the audit
  returned `pass "No blocking CAPTCHA scripts detected on scanned pages."` at
  weight 1.0 about every client-rendered site. `requires` is empty so the wall
  branch stays reachable behind a 403, which means the evidence gate does not
  decline this case — the audit has to. Measured on the shell contract state:
  pass → na. A consequence worth naming: this was the only
  `operability-safety` check that scored on a shell, so that category's score
  on such a scan moves 100 → 0, which is what `calculateCategoryScore` returns
  when nothing in a category was assessed. A shell scan carries no overall
  score in either version.
- 2026-08-28 — `scanReadTheSite()` now reads `evidence.judgeable`
  (`origin-reachable && unblocked-fetches`) rather than `origin-reachable`
  alone, because a Cloudflare managed challenge is served at HTTP 200,
  `text/html`, from the requested host. This audit's verdict on that state is
  unchanged: the wall branch above the guard reports the wall either way.

### Detection reads widget markup, not body text (2026-10-06)

The audit matched `recaptcha`, `hcaptcha` and `turnstile` anywhere in the
body. A large retail site's inline config (`provider = "CloudflareTurnstile"`)
matched as a CAPTCHA. Detection now uses the selectors the review asks for: a
`<script src>` from the vendor's loader path, or the element the widget mounts
on (`.g-recaptcha`, `.h-captcha`, `.cf-turnstile`). Prose, config and CSP text
no longer match. A Turnstile, reCAPTCHA or hCaptcha widget on a form still
warns.

## Deferred

- **Interactive versus invisible variants.** The counter-evidence shows that
  reCAPTCHA v3, Turnstile's managed and invisible modes and hCaptcha's passive
  mode do not stop an agent. The markup alone does not say which mode a widget
  runs in: the mode is usually set in the vendor dashboard or in a script
  call. Every detected widget still warns.
- **Form correlation.** The finding names the page, not the form the widget
  guards.

## Evidence (2026-08-21)

**Mechanism claim:** An interactive CAPTCHA can gate a form: a reCAPTCHA v2 checkbox or challenge, an hCaptcha visual challenge, or Cloudflare Turnstile in managed or interactive mode. It stops an autonomous browsing agent from submitting that form on its own. The agent must hand control back to a human.

**Grade: A** — OpenAI's computer-use guide names "Solving CAPTCHA challenges" as an action the agent must not perform unattended. The CAPTCHA vendors document that their interactive modes exist precisely to require a human response. The blocking path is documented consumer behavior, not inference.

**Evidence:**

- OpenAI's computer-use agent guide lists "Solving CAPTCHA challenges" among the actions that require explicit user confirmation immediately before execution, and treats bypassing a site's safety barrier as requiring full human takeover — https://developers.openai.com/api/docs/guides/tools-computer-use (verified 2026-08-21)
- hCaptcha states it "helps to protect your sites and apps from bots, spam, and other automated abuse" — its purpose is to deny non-human clients — https://docs.hcaptcha.com/ (verified 2026-08-21)
- reCAPTCHA v2 gates the `g-recaptcha-response` token on the user submitting a successful response; without that interaction there is no token to post with the form — https://developers.google.com/recaptcha/docs/display (verified 2026-08-21)
- Anthropic's browser use tool documents no CAPTCHA-handling path at all: it acts on the accessibility tree and screenshots and assumes it can reach the page — https://platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-tool (verified 2026-08-21)

**Counter-evidence:** The blocking property belongs to the _interactive_ variants only. Every vendor documents a frictionless mode that agents pass without noticing. reCAPTCHA v3 "returns a score for each request without user friction", and "will never interrupt your users" (https://developers.google.com/recaptcha/docs/v3, verified 2026-08-21). Turnstile ships managed, non-interactive and invisible widget types, and is marketed as a "CAPTCHA-free" alternative (https://developers.cloudflare.com/turnstile/, verified 2026-08-21). hCaptcha offers "nearly passive 'No-CAPTCHA' modes" (https://docs.hcaptcha.com/, verified 2026-08-21). The mechanism is therefore proven for the interactive case and false for the invisible case — which is exactly the distinction this audit's whole-body substring scan cannot make, and which its own remediation text recommends adopting.
