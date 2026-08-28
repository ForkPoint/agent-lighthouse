---
audit: access-crawl-control/no-bot-detection
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/no-bot-detection.ts
slug: no-bot-detection
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - cloudflare-block-ai-bots
  - cloudflare-content-independence-day
  - perplexity-bots-docs
  - s18
  - anthropic-crawlers
---

# no-bot-detection (`2.26`)

> crawler-permissions · source `no-bot-detection.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

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

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** An edge bot-management rule that blocks or challenges requests carrying a named AI agent's user-agent or IP hands that agent a non-200 or challenge response instead of the page. The content then cannot be fetched, indexed or cited. AI vendors publish per-agent IP ranges specifically so operators can allowlist them past those rules.

**Grade: A** — the blocking behavior is a documented product feature of the largest CDN, and multiple AI vendors document per-agent IP endpoints plus explicit WAF allowlisting instructions, which only make sense because bot defense demonstrably intercepts their agents.

**Evidence:**
- Cloudflare, Block AI bots. The feature blocks AI bots by behavior category: **Search** for content indexing, **Agent** for real-time automated activity, and **Training** (model development) — covering "Verified bots classified with that behavior, plus additional unverified bots that fall under these classifications". From **15 September 2026** the platform default becomes: bots classified as Training or as Agent are blocked on pages that display ads, Search remains allowed — https://developers.cloudflare.com/bots/additional-configurations/block-ai-bots/ (verified 2026-08-21)
- Cloudflare, "Content Independence Day" (1 July 2025): "Cloudflare, along with a majority of the world's leading publishers and AI companies, is changing the default to block AI crawlers unless they pay creators for their content." Establishes that default-deny at the edge, not site-authored robots.txt, is now the dominant blocking mechanism — https://blog.cloudflare.com/content-independence-day-no-ai-crawl-without-compensation/ (verified 2026-08-21)
- Perplexity crawler docs give operators explicit Cloudflare and AWS WAF allowlisting guidance and recommend combining "both User-Agent and IP address conditions", with published endpoints `https://www.perplexity.com/perplexitybot.json` and `https://www.perplexity.com/perplexity-user.json` — https://docs.perplexity.ai/guides/bots (verified 2026-08-21)
- OpenAI publishes per-agent IP ranges (`openai.com/searchbot.json`, `openai.com/gptbot.json`, `openai.com/chatgpt-user.json`, `openai.com/adsbot.json`) for exactly this allowlisting purpose — https://developers.openai.com/api/docs/bots (verified 2026-08-21)
- Anthropic publishes verified crawler IPs at `https://claude.com/crawling/bots.json` and warns that "blocking IP address(es)…may not work correctly or persistently guarantee an opt-out" — https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler (verified 2026-08-21)

**Counter-evidence:** The A grade attaches to the `ctx.wafProtection.isBlocked` branch — observed blocking of the actual fetch. The second branch scans page HTML for the substrings `recaptcha`, `challenges.cloudflare.com`, `hcaptcha.com` and `datadome.co`. It has **no documented consumer link**. None of the vendor docs above state that the presence of a CAPTCHA widget on a page affects crawler access — and the page was by definition retrievable, since the scanner parsed it. Graded on its own, that sub-signal is D — presence of a form-scoped challenge widget is not evidence of agent blocking. Note also that the dominant 2026 mechanism the Cloudflare docs describe is UA/IP classification at the edge, which is invisible to a same-UA page scan — so the audit's proven half is the half the implementation barely exercises.

## Limits

A throttled scan proves nothing. HTTP 429 means "too many requests" — a
statement about the rate this scan asked at, not about who the site admits. The
audit returns not-applicable on a 429 rather than reporting a bot defense, and
`waf-detector.ts` diagnoses it as a rate limit before it considers any provider,
because every provider serves 429 for throttling. Until 2026-08-25 the audit
failed at critical priority on a 429, which told storefronts that serve GPTBot
perfectly well that their firewall blocks AI crawlers. Re-running the scan after
a pause is the only way to get a verdict from a rate-limited origin.

## Implementation deviations

- 2026-08-28 — the audit declines when the scan holds no response it can
  attribute to this site. It read the scripts on the scanned pages, and
  `ctx.pages`/`ctx.rootFiles` carry whatever answered 200 — on a parked domain
  a broker's page from another host, on a walled or throttled origin nothing
  at all. It now consults `scanReadTheSite()` and returns `notApplicable`
  carrying the gate's own reason.
  The guard sits **below** the `wafProtection.isBlocked` branch, not above it:
  a bot-defense firewall is this audit's subject, so a walled scan still fails
  and names the firewall. `requires` is now empty and the gate exemption drops
  `origin-reachable` too — a 403 denies that key, so the gate had been
  skipping this audit before it could report the very wall that produced the
  403.
  Verdicts that moved on the five nothing-obtained contract states: redirected
  away pass → na, non-HTML homepage pass → na, HTTP 200 bot challenge
  unchanged. Found by
  `packages/core/src/tests/hostile-state-contract.test.ts`.
- 2026-08-28 — the "found nothing" branch declines a page that served no
  readable text. The detection is a substring search over the served HTML, and
  a JS shell serves a mount point and a bundle: the Turnstile or DataDome
  loader a user's agent meets is inside that bundle, where the search cannot
  reach it. Before this the audit returned `pass "No aggressive bot-detection
  scripts found on scanned pages."` at weight 1.0 about every client-rendered
  site. `requires` is empty so the wall branch stays reachable behind a 403,
  which means the evidence gate does not decline this case — the audit has to.
  The wall and detection branches above still run first, so a shell that does
  ship a challenge loader statically is still reported. Measured on the shell
  contract state: pass → na.
- 2026-08-28 — `scanReadTheSite()` now reads `evidence.judgeable`
  (`origin-reachable && unblocked-fetches`) rather than `origin-reachable`
  alone, because a Cloudflare managed challenge is served at HTTP 200,
  `text/html`, from the requested host. This audit's verdict on that state is
  unchanged: the wall branch above the guard reports the firewall either way.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-21 — evidence graded **A** (mechanism research pass); grade applies to the WAF-observation branch only.
- 2026-08-25 — HTTP 429 separated from bot defense. Found by scanning 48 live storefronts back to back: 36 came back reported as a Cloudflare managed challenge, and a single-request `curl` with the same user-agent got HTTP 200 from every one of them. The scan was being throttled, and the audit was reading throttling as a firewall.
