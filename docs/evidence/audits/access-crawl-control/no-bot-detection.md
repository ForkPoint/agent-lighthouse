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

Bot-detection services like Cloudflare Turnstile, DataDome, and reCAPTCHA can block legitimate AI agents from accessing your content. Configure your service to allowlist known AI user-agents.

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

### A loader on a readable page passes (2026-10-06)

The page-script branch warned at weight 1 on any page whose HTML contained a
challenge host, including `challenges.cloudflare.com`. The counter-evidence
grades that sub-signal D, and the required fix says to warn only when the
widget gates the main content. A loader is now reported only on a page that
served no readable text, using the per-page `renderedByPage` verdict from the
scan evidence (`pageRendersText` when it is absent). A loader on a page the
scan read is named in a pass, because no wall was observed and the page was
read. The `wafProtection` branch, which carries the A grade, is unchanged.
Script-`src` scoping and a UA probe are still open items from the review above.

- 2026-10-17 — an AWS WAF Challenge or CAPTCHA response is a wall. AWS
  documents both rule actions as answering a request without a valid token
  with the header `x-amzn-waf-action` (`challenge` with HTTP 202, `captcha`
  with HTTP 405); see
  https://docs.aws.amazon.com/waf/latest/developerguide/waf-captcha-and-challenge-actions.html
  (verified 2026-10-17). A corpus site answered the scanner with an empty
  HTTP 202 and that header. The scan reported it as a page with too little
  evidence; it now names AWS WAF. Like every vendor marker, the header on a
  root file counts only when the homepage failed.

- 2026-10-16 — a homepage chain that ends on a storefront platform's
  challenge route is a wall: `PX-Show` names PerimeterX and
  `DDUser-Challenge` names DataDome. The route page answered 404 with the
  shop's error page, or 200 with a script-only challenge, so the scan said
  "HTTP 404" without naming the vendor. The same day the fetcher began to
  send cookies back along one redirect chain and to follow 20 hops, as
  browsers do. Sites that looped until a locale cookie came back now load;
  some of those chains end on the DataDome route above.

- 2026-10-16 — the shared WAF detector judges the wall from the pages the
  scan read. A live run over 684 corpus sites found 12 sites reported as walled
  although the homepage answered 200 and was read: a 403 S3 `AccessDenied`
  document for a missing `/.well-known/` file read as Akamai, a Cloudflare rule
  on one sitemap or `/agents.md`, an Imperva path named in `robots.txt`, and
  the DataDome tag on an open page. Root files now count only when the homepage
  itself failed. A vendor marker counts only with a refusal status or on a page
  with no readable text, and "access denied" names Akamai only beside an
  Akamai header. A 200 Akamai page titled "Access Denied" with no readable
  text, which one site served to every client as a geo block, is now a wall.
  A challenge on the homepage is named before a 429 on a root file, and a
  vendor's own challenge before a bare Cloudflare 403. DNS, refused-port, TLS,
  certificate and connect-timeout failures are no longer reported as a bot
  wall; the evidence gate reports them as an unreachable homepage. The A-grade
  branch still reads observed blocking; these corrections make the observation
  match the fetch the scan made.

- 2026-10-06 — the shared WAF detector no longer treats the
  `challenges.cloudflare.com` hostname as proof of an access wall. A live fetch
  of a storefront returned HTTP 200 with the storefront HTML and a
  Turnstile loader configured for login, registration and newsletter forms.
  The detector still recognises challenge headers, refusal responses and
  managed challenge-page loaders. The page-script warning remains separate;
  this correction removes the false wall and restores content audit evidence.
  Regression tests cover Turnstile script/preconnect markup, JavaScript
  Detections, a managed challenge loader and the scan evidence path.

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
  skipping this audit before it could report the very wall that produced the 403.
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
