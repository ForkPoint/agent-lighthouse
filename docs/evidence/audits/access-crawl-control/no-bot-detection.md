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
  - aws-waf-captcha-challenge-actions
---

# no-bot-detection (`2.26`)

> crawler-permissions · source `no-bot-detection.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Whether a bot-defense wall stopped the scan, and whether a challenge loader sits on a page that served no readable text. Bot-detection services such as Cloudflare Turnstile, DataDome and reCAPTCHA can block legitimate AI agents. Configure the service to allowlist the AI agents you want to admit.

| State                                                     | Result                      |
| :-------------------------------------------------------- | :-------------------------- |
| the scan was rate-limited (HTTP 429)                      | `na`                        |
| a firewall or bot defense refused the scan                | `fail`, priority `critical` |
| no wall detected and no page scanned                      | `na`                        |
| a challenge loader on a page that served no readable text | `warn`, priority `high`     |
| no loader found, but no scanned page served readable text | `na`                        |
| a loader only on readable pages, or no loader at all      | `pass`                      |

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

- `requires` is empty. A 403 denies `origin-reachable`, and the gate would otherwise skip this audit before it could report the wall that produced the 403.
- The `wafProtection.isBlocked` branch runs first, so a walled scan still fails and names the firewall.
- A challenge loader is reported only on a page that served no readable text, judged by `renderedByPage` (or `pageRendersText` when absent). A loader on a readable page is named in a pass. The counter-evidence grades a form-scoped widget D.
- Finding no loader on a page with no readable text is not applicable. The substring search cannot see a loader inside a JS bundle, and the gate does not decline this case because `requires` is empty.
- The shared `waf-detector.ts` judges the wall from the pages the scan read. Root files count only when the homepage itself failed.
- A vendor marker counts only with a refusal status or on a page with no readable text. "Access denied" names Akamai only beside an Akamai header.
- The `challenges.cloudflare.com` hostname alone is not proof of a wall. A Turnstile loader for forms is common on open pages.
- An `x-amzn-waf-action` header (`challenge` or `captcha`) names AWS WAF. A homepage chain ending on `PX-Show` or `DDUser-Challenge` names PerimeterX or DataDome.
- DNS, refused-port, TLS, certificate and connect-timeout failures are not a bot wall. The evidence gate reports them as an unreachable homepage.

- No wall detected and no page scanned is not applicable. It used to warn, which judged bot defenses the scan never saw.

## Deferred

- Scoping the page-script search to script `src` attributes, instead of a substring search over the whole HTML.
- A UA probe for the edge classification the same-UA scan cannot see.
