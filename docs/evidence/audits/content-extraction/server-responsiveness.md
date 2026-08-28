---
audit: content-extraction/server-responsiveness
category: content-extraction
source_file: packages/core/src/audits/content-extraction/server-responsiveness.ts
slug: server-responsiveness
evidence_grade: B
disposition: "merged + rewritten 2026-08-22 (Plan 4, Task 8) — absorbs fast-response-time (8.12)"
reviewed: 2026-08-22
recommended_tier: scored
consumers:
  - "Googlebot / Google AI Overviews & AI Mode"
  - OAI-SearchBot
  - ChatGPT-User
  - GPTBot
  - ClaudeBot
  - PerplexityBot
signals:
  - name: TTFB / server response time effect on AI crawl rate and agent abandonment
    grade: B
    domain: technical-infra
sources:
  - google-crawl-budget-docs
  - google-http-status-codes
  - anthropic-crawlers
  - ipullrank-page-speed-ai
  - implicator-chatgpt-499-report
  - vercel-rise-of-ai-crawler
---

# server-responsiveness (`1.19`, `8.12`)

> content-extraction · source `server-responsiveness.ts` · merged + rewritten TTFB audit, absorbs fast-response-time (8.12) · evidence grade **B** · tier **scored** (weight 0.6)

## What it checks

One TTFB audit: the **median** across every page the crawl actually measured, graded in **bands**.

| State | Result |
| :--- | :--- |
| the scan was blocked by a WAF, or no page fetch completed (including an empty crawl) | `na` |
| median TTFB ≤ 800ms | `pass` |
| median TTFB 801–2500ms | `warn`, priority `medium` |
| median TTFB > 2500ms | `fail`, priority `high` |

Pages whose fetch errored are excluded from the sample rather than charged the timeout value, and the `found` string states that the figure includes DNS, TCP and TLS setup measured from the scanner's location.

## Code review findings (2026-08-20, 11-agent pass)

Fails when any page's TTFB exceeds 1800ms, warns above an 800ms average. The underlying concern is legitimate, but the measurement is a single unrepeated sample taken while the scanner fetches many pages of the same origin in parallel — the audit substantially creates the latency it then reports — and the fetcher's ttfbMs also folds in DNS and TLS. Verdicts vary run to run.

**Required fix:** Sample each page's TTFB at least twice (discard the first, cold-cache request) and grade on the median rather than the max. Serialize or throttle the timing requests so the scanner's own concurrency is not measured. Exclude pages whose fetch errored (status 0) from the TTFB set instead of charging them the timeout value. State the scanner's region in the message, and require more than one slow page before failing.

**False-positive risks:**
- One sample per page, no median/retry. Serverless cold starts, a first-hit CDN miss, or one transient GC pause flips the verdict from PASS to FAIL with no site change.
- The orchestrator fetches pages concurrently, so the scanner's own parallel load inflates every TTFB. Origins with per-IP connection limits or rate limiting are systematically over-reported as slow.
- `ttfbMs = performance.now() - start` is measured around undici's `request()` and therefore includes DNS resolution and the TLS handshake — a slow resolver or a distant scanner region is charged to the site.
- Geography is unmodelled: a site correctly served from a regional origin is failed when scanned from another continent.
- `slowPages.length > 0` means ONE slow page out of twenty produces a category-wide FAIL, while the 'avg' figure quoted in the same message can be comfortably fast — internally inconsistent reporting.
- 800/1800ms thresholds are hardcoded with no rationale and no allowance for uncached first-request behaviour.
- On fetch error the fetcher returns ttfbMs = totalMs (the full timeout, ~10000ms), so a page that failed to load is reported as an extreme-TTFB slow page rather than an error.

**Test gaps:**
- Errored fetch (status 0) inflating ttfbMs to the full timeout — currently reported as a slow page
- One slow page among many while the average is fast (inconsistent messaging)
- Cold-start vs warm-cache repeat measurement
- Behaviour under scanner-induced parallel load
- Threshold boundaries at exactly 800/1800ms

**Overlaps with:** `8.12` (now absorbed here)

## Evidence

### Signal: TTFB / server response time effect on AI crawl rate and agent abandonment — grade B (technical-infra)

**Mechanism:** Higher time-to-first-byte reduces the number of URLs an AI crawler fetches per unit time. It also raises the probability that a user-triggered agent fetch is abandoned before bytes arrive, which the origin logs as HTTP 499, client-closed-request. Both reduce the page's eligibility to be cited. Falsifiable form: reducing origin TTFB on a fixed URL set increases AI-crawler fetch volume and reduces 499/timeout rate for OAI-SearchBot, ChatGPT-User, ClaudeBot and PerplexityBot.

**Grade: B** — First-party for the Google side and stated causally: "If the site slows down (latency increases or response times become longer)… the limit goes down and Google crawls less", with the crawl capacity limit described as hostload. That is a documented consumer, but for one crawler and with no threshold. No AI vendor publishes a timeout, so the widely repeated "1–5 second" budget is folklore and the audit never cites it as vendor guidance. The abandonment research is second-hand with no published sample size. The audit therefore scores response time as a crawl-budget signal, which is what the evidence supports, and not as a citation-rate signal.

**Evidence:** Documented first-party for the Google side: 'If the site slows down (latency increases or response times become longer)... the limit goes down and Google crawls less', with the crawl capacity limit explicitly described as hostload. Google also documents that 5xx and 429 responses 'prompt Google's crawlers to temporarily slow down with crawling', proportional to the share of erroring URLs — which matters for AI because AI Overviews/AI Mode eligibility flows through that same index. Anthropic corroborates load-sensitivity indirectly by being the one AI vendor that explicitly supports robots.txt Crawl-delay. On the AI-specific side the evidence is empirical, but second-party. Profound's April 2026 analysis of a random 700K-page sample found that pages with fetch-failure rates above 75% received roughly 18x fewer citation events, many of them zero. Log-based reporting attributes clusters of HTTP 499s to OAI-SearchBot, ChatGPT-User and GPTBot on slow origins.

**Counter-evidence:** No AI vendor publishes a timeout threshold — not OpenAI, not Anthropic, not Perplexity — so any specific number (the widely repeated '1–5 second' budget) is unsourced folklore and must not be cited as vendor guidance. The 499 research is reported second-hand with no published sample size or methodology, and the Profound figure is a correlation between failure rate and citation count that is plausibly confounded by site quality and authority. Note also the direction is not purely 'faster is better for the publisher': Vercel's data shows GPTBot and ClaudeBot generating 569M and 370M requests/month respectively on one network, so a faster origin also invites more uncompensated crawl.

## Implementation deviations

- 2026-08-28 — the audit declines when the scan holds no response it can
  attribute to this site. It read the TTFB of the scanned pages, and
  `ctx.pages`/`ctx.rootFiles` carry whatever answered 200 — on a parked domain
  a broker's page from another host, on a walled or throttled origin nothing
  at all. It now consults `scanReadTheSite()` and returns `notApplicable`
  carrying the gate's own reason.
  The guard sits **below** the `wafProtection.isBlocked` branch, so a walled
  scan still reports that the time could not be measured and names the wall,
  rather than the generic attribution message.
  Verdicts that moved on the four nothing-obtained contract states: redirected
  away pass → na, non-HTML homepage pass → na. Found by
  `packages/core/src/tests/hostile-state-contract.test.ts`.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-21 — approved: 1.19 and 8.12 collapse into one banded median-TTFB audit (the `TODO(rewrite)` header).
- 2026-08-22 — merged and rewritten (Plan 4, Task 8); registry 152 → 151 for this fold.

## The merge + rewrite (Plan 4, Task 8, 2026-08-22)

Two audits measured the same number off the same fetches and disagreed with each other and with themselves. 1.19 failed if *any one* page exceeded 1800ms while quoting a comfortable average in the same sentence; 8.12 failed the homepage's single cold sample at a hard 800ms cliff while its own description said crawlers "abandon requests over 2-3 seconds" — a threefold disagreement between threshold and rationale, with no warn band despite `scoreDisplayMode: 'ternary'` advertising one. The `TODO(rewrite)` header names the resolution: *median TTFB across the crawled pages, banded rather than pass/fail on a single sample.* That is what this audit now is.

**Median, not max and not mean.** 1.19's `slowPages.length > 0` rule turned one slow page out of twenty into a category-wide failure; its `avgTtfb` is dragged by exactly the outliers a crawl always contains (one cold serverless start, one CDN miss). 8.12 used one sample from one page. The verdict is now the median over every measurable page, which is stable against a single unlucky fetch in either direction.

**Bands, not a cliff.** `pass ≤ 800ms`, `warn ≤ 2500ms`, `fail` beyond — the ternary the meta always claimed, with the upper bound set where both dossiers' own copy puts crawler abandonment rather than at a number three times below it.

**Failed fetches leave the sample.** On a fetch error the fetcher reports `ttfbMs = totalMs`, i.e. the full ~10s timeout, so an unreachable page was reported as an extremely slow one. 1.19's required fix asks for exactly this exclusion; unmeasurable pages are now counted and named in `found`, and a crawl where nothing completed is `na`.

**A WAF challenge is not a performance defect.** 8.12's required fix asks for `na` when `ctx.wafProtection?.isBlocked`, since a challenge or JS interstitial is slow by design. Implemented.

### Absorbed evidence — fast-response-time (8.12)

8.12's dossier is kept verbatim at [merged/content-extraction/fast-response-time.md](../../merged/content-extraction/fast-response-time.md) (grade **B**). Both audits were graded on the *same* signal record — *TTFB / server response time effect on AI crawl rate and agent abandonment* — so there was never a second signal to lose: Google's crawl-capacity documentation ("if the site slows down … the limit goes down and Google crawls less"), Anthropic's `Crawl-delay` support, and the second-party 499/citation observations, against counter-evidence that no AI vendor publishes a timeout number at all.

That counter-evidence is why the bands are stated as bands. The dossiers are explicit that the widely repeated "1–5 second budget" is unsourced folklore, so 800ms is a target and 2500ms is the edge of the abandonment window both audits' copy already claimed — neither is presented as a vendor threshold.

### Grade decision: stays **B**, tier `scored`, weight 0.6

One signal, one grade: both audits carry **B** off the identical evidence record, so the merge cannot raise it. **B**, `tier: scored`, `weightForGrade('B', 'scored')` = **0.6**. The rewrite does not change the price; it changes what earns it, and removes the double charge for a single measurement.

### Deviations

- **No repeat sampling.** Both required fixes ask for at least two samples per page with the cold one discarded, and for the timing requests to be serialised so the scanner's own concurrency is not measured. That needs orchestrator and fetcher changes (a second timing pass, throttled) beyond this audit, and would add a request per page to every scan. The median across pages is the affordable half of that fix; the systematic inflation from scanner-induced parallel load remains.
- **Connection setup is disclosed, not subtracted.** Isolating DNS/TCP/TLS needs `undici`'s diagnostics channel wired into `FetchResult`. Instead the `found` string says plainly that the figure includes connection setup measured from the scanner's location — 8.12's fix offers exactly this alternative.
- **Scanner region is not named**, only its influence. The scanner has no region identity to report today.
- **Redirect chains are still included** in the measurement, since the fetcher follows them inside one `request()` call.
- **The title changes** from "Fast page load" to "Server responsiveness", matching the audit id and slug that Plan 3 already gave it, and the class is renamed `FastPageLoadAudit` → `ServerResponsivenessAudit`.
