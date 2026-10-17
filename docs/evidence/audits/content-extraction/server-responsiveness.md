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

| State                                                                                | Result                    |
| :----------------------------------------------------------------------------------- | :------------------------ |
| the scan was blocked by a WAF, or no page fetch completed (including an empty crawl) | `na`                      |
| median TTFB ≤ 800ms                                                                  | `pass`                    |
| median TTFB 801–2500ms                                                               | `warn`, priority `medium` |
| median TTFB > 2500ms                                                                 | `fail`, priority `high`   |

Pages whose fetch errored are excluded from the sample rather than charged the timeout value, and the `found` string states that the figure includes DNS, TCP and TLS setup measured from the scanner's location.

## Evidence

### Signal: TTFB / server response time effect on AI crawl rate and agent abandonment — grade B (technical-infra)

**Mechanism:** Higher time-to-first-byte reduces the number of URLs an AI crawler fetches per unit time. It also raises the probability that a user-triggered agent fetch is abandoned before bytes arrive, which the origin logs as HTTP 499, client-closed-request. Both reduce the page's eligibility to be cited. Falsifiable form: reducing origin TTFB on a fixed URL set increases AI-crawler fetch volume and reduces 499/timeout rate for OAI-SearchBot, ChatGPT-User, ClaudeBot and PerplexityBot.

**Grade: B** — First-party for the Google side and stated causally: "If the site slows down (latency increases or response times become longer)… the limit goes down and Google crawls less", with the crawl capacity limit described as hostload. That is a documented consumer, but for one crawler and with no threshold. No AI vendor publishes a timeout, so the widely repeated "1–5 second" budget is folklore and the audit never cites it as vendor guidance. The abandonment research is second-hand with no published sample size. The audit therefore scores response time as a crawl-budget signal, which is what the evidence supports, and not as a citation-rate signal.

**Evidence:** Documented first-party for the Google side: 'If the site slows down (latency increases or response times become longer)... the limit goes down and Google crawls less', with the crawl capacity limit explicitly described as hostload. Google also documents that 5xx and 429 responses 'prompt Google's crawlers to temporarily slow down with crawling', proportional to the share of erroring URLs — which matters for AI because AI Overviews/AI Mode eligibility flows through that same index. Anthropic corroborates load-sensitivity indirectly by being the one AI vendor that explicitly supports robots.txt Crawl-delay. On the AI-specific side the evidence is empirical, but second-party. Profound's April 2026 analysis of a random 700K-page sample found that pages with fetch-failure rates above 75% received roughly 18x fewer citation events, many of them zero. Log-based reporting attributes clusters of HTTP 499s to OAI-SearchBot, ChatGPT-User and GPTBot on slow origins.

**Counter-evidence:** No AI vendor publishes a timeout threshold — not OpenAI, not Anthropic, not Perplexity — so any specific number (the widely repeated '1–5 second' budget) is unsourced folklore and must not be cited as vendor guidance. The 499 research is reported second-hand with no published sample size or methodology, and the Profound figure is a correlation between failure rate and citation count that is plausibly confounded by site quality and authority. Note also the direction is not purely 'faster is better for the publisher': Vercel's data shows GPTBot and ClaudeBot generating 569M and 370M requests/month respectively on one network, so a faster origin also invites more uncompensated crawl.

## Implementation deviations

- This audit absorbed `fast-response-time`, which measured the same number off the same fetches on the same grade-B signal. Its record is in [merged/content-extraction/fast-response-time.md](../../merged/content-extraction/fast-response-time.md).
- The verdict is the median TTFB over every measurable page. One slow page or one cold sample does not decide it.
- Bands: pass at or below 800ms, warn to 2500ms, fail beyond. No vendor publishes a timeout, so 800ms is a target and 2500ms is the edge of the observed abandonment window.
- Failed fetches leave the sample. The fetcher reports a failed fetch's TTFB as the full timeout. A crawl where nothing completed returns `notApplicable`.
- A WAF challenge returns `notApplicable` and names the wall. A challenge is slow by design.
- `requires` is `[OriginReachable, UnblockedFetches]` only. TTFB is measured from the response, so a client-rendered scan is still judged. The exemption is recorded in `scripts/lib/requires-analysis.ts`.
- No repeat sampling. Discarding a cold sample and serialising timing requests need orchestrator and fetcher changes, and would add a request per page.
- Connection setup is disclosed in `found`, not subtracted. Isolating DNS, TCP and TLS needs `undici` diagnostics wired into `FetchResult`.
- The scanner region is not named. The scanner has no region identity.
- Redirect chains are included in the measurement.
