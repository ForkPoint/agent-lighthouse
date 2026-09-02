---
audit: content-extraction/fast-response-time
audit_id: "8.12"
category: content-extraction
source_file: packages/core/src/audits/content-extraction/fast-response-time.ts
slug: fast-response-time
review_verdict: fix
severity: high
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# fast-response-time (`8.12`)

> technical-readiness · source `fast-response-time.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

AI crawlers have strict timeout budgets per page. GPTBot and ClaudeBot typically abandon requests over 2-3 seconds, and slow TTFB reduces the number of pages they crawl per session. Optimize to under 800ms with server-side caching, CDN, and reduced backend processing.

## Code review findings (2026-08-20, 11-agent pass)

Real signal, but a hard 800 ms cliff applied to a single cold measurement makes the verdict close to a coin flip for a large band of ordinary sites. `page.fetchResult.ttfbMs` is `performance.now()` from just before `request()` to the moment response headers arrive — it therefore includes DNS resolution, TCP connect and the full TLS handshake on a cold connection from wherever the scanner happens to run, which is routinely 300-600 ms of pure setup before the origin does any work. The audit's own copy says crawlers 'abandon requests over 2-3 seconds', then fails at 800 ms with priority `high` and score 0.0 — the threshold and the stated rationale disagree by a factor of three, and there is no warn band between them.

**Required fix:** Take the median (or minimum) TTFB across all fetched pages in `ctx.pages` rather than the homepage's single cold sample, and introduce the ternary band the meta already claims: pass < 800 ms, warn 800-2500 ms, fail > 2500 ms — aligning the thresholds with the audit's own '2-3 second crawler timeout' rationale. Have the fetcher record connect/TLS time separately (undici diagnostics channel) and subtract it, or state plainly in `found` that the figure includes connection setup measured from the scanner's location. Return `na` when `ctx.wafProtection?.isBlocked`.

**False-positive risks:**

- Cold-connection inflation: TTFB is measured from before connect, so DNS+TCP+TLS are counted as server slowness. A site with a genuine 250 ms origin TTFB measured trans-Pacific fails the 800 ms gate on setup cost alone; re-running from a nearer network flips the verdict with no change to the site.
- Single sample, no retry or median: one packet-loss event or one cold serverless start (Lambda/Cloud Run/Vercel first-hit) produces a permanent 'fail' in the report. `ctx.pages` holds every crawled page and none of their timings are used.
- Measurement position: the homepage is fetched in Phase 2 right after Phase 1 fires ~34 parallel root-file requests through the same undici agent, so connection-pool and origin contention created by the scanner itself is charged to the site.
- Redirect chains are included: an http→https→www chain is followed inside the single `request()` call, so two extra round-trips land in `ttfbMs` and are reported as slow origin response.
- Binary cliff: 799 ms ⇒ 1.0, 801 ms ⇒ 0.0, with priority `high`. No warn band despite `scoreDisplayMode: 'ternary'` advertising one.
- WAF interaction: a challenge/JS-interstitial response is slow by design and gets reported as a site performance defect rather than as bot protection.

**Test gaps:**

- No test at the boundary (799/800/801) documenting the cliff.
- No test separating connection setup from server think-time.
- No test using timings from multiple pages (median vs single sample).
- No test for a redirect chain inflating TTFB.
- No test for cold-start/serverless behavior or for a WAF challenge latency.

**Overlaps with:** `8.1`

## Evidence

### Signal: TTFB / server response time effect on AI crawl rate and agent abandonment — grade B (technical-infra)

**Mechanism:** Higher time-to-first-byte reduces the number of URLs an AI crawler fetches per unit time and raises the probability that a user-triggered agent fetch is abandoned before bytes arrive (logged at origin as HTTP 499 / client-closed-request), reducing the page's eligibility to be cited. FALSIFIABLE FORM: reducing origin TTFB on a fixed URL set increases AI-crawler fetch volume and reduces 499/timeout rate for OAI-SearchBot, ChatGPT-User, ClaudeBot and PerplexityBot.

**Evidence:** Documented first-party for the Google side: 'If the site slows down (latency increases or response times become longer)... the limit goes down and Google crawls less', with the crawl capacity limit explicitly described as hostload. Google also documents that 5xx and 429 responses 'prompt Google's crawlers to temporarily slow down with crawling', proportional to the share of erroring URLs — which matters for AI because AI Overviews/AI Mode eligibility flows through that same index. Anthropic corroborates load-sensitivity indirectly by being the one AI vendor that explicitly supports robots.txt Crawl-delay. On the AI-specific side the evidence is empirical but second-party: Profound's April 2026 analysis of a random 700K-page sample found pages with >75% fetch-failure rates received roughly 18x fewer citation events, many zero; log-based reporting attributes clusters of HTTP 499s to OAI-SearchBot/ChatGPT-User/GPTBot on slow origins.

**Counter-evidence:** No AI vendor publishes a timeout threshold — not OpenAI, not Anthropic, not Perplexity — so any specific number (the widely repeated '1–5 second' budget) is unsourced folklore and must not be cited as vendor guidance. The 499 research is reported second-hand with no published sample size or methodology, and the Profound figure is a correlation between failure rate and citation count that is plausibly confounded by site quality and authority. Note also the direction is not purely 'faster is better for the publisher': Vercel's data shows GPTBot and ClaudeBot generating 569M and 370M requests/month respectively on one network, so a faster origin also invites more uncompensated crawl.
**Consumers:** Googlebot / Google AI Overviews & AI Mode, OAI-SearchBot, ChatGPT-User, GPTBot, ClaudeBot, PerplexityBot · **Recommended tier:** scored

**Sources:** [Large site owner's guide to managing your crawl budget](https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget) · [How HTTP status codes, and network and DNS errors affect Google Search](https://developers.google.com/search/docs/crawling-indexing/http-network-errors) · [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) · [Quick Tip: How Page Speed Impacts ChatGPT and Perplexity Visibility](https://ipullrank.com/page-speed-impacts) · [ChatGPT Search Abandons Slow Sites With 499 Timeout Errors](https://www.implicator.ai/is-chatgpt-quietly-reshaping-the-web-by-penalizing-slow-sites/) · [The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

**Merged into:** `content-extraction/server-responsiveness` (Plan 4, 2026-08-22) — [merged dossier](../../audits/content-extraction/server-responsiveness.md)
