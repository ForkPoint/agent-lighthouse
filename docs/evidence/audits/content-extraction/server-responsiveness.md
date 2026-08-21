---
audit: content-extraction/server-responsiveness
audit_id: "1.19"
category: content-extraction
source_file: packages/core/src/audits/content-extraction/server-responsiveness.ts
slug: server-responsiveness
review_verdict: fix
severity: medium
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# fast-page-load (`1.19`)

> content-discoverability · source `fast-page-load.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

AI crawlers have limited time budgets. Fast Time-to-First-Byte (TTFB) ensures crawlers can fetch more of your pages within their allotted time.

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

**Overlaps with:** _none_

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
