---
audit: machine-discovery/no-broken-links
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/no-broken-links.ts
slug: no-broken-links
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: scored
consumers:
  - GPTBot / ChatGPT-User / OAI-SearchBot
  - ClaudeBot
  - Applebot (documented to throttle on errors)
  - "browsing agents (ChatGPT agent, Operator-class CUA agents)"
signals:
  - name: Soft-404 / SPA catch-all rewrite (HTTP 200 for everything) as a false-result source
    grade: A
    domain: technical-infra
  - name: Broken links / high 4xx-5xx rate on internally linked URLs
    grade: B
    domain: discovery-infra
sources:
  - google-fix-search-javascript
  - google-http-status-codes
  - google-crawl-budget-docs
  - vercel-rise-of-ai-crawler
  - oncrawl-ai-bot-logs
  - applebot-doc
  - cloudflare-crawl-refer-ratio
  - browserarena-arxiv
  - google-rel-ugc
---

# no-broken-links (`1.20`)

> content-discoverability · source `no-broken-links.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Broken internal links create dead ends for AI crawlers and waste their limited crawl budget.

## Code review findings (2026-08-20, 11-agent pass)

Fetches up to 20 internal links and reports any non-200 as broken. Valuable in principle, but the sample is the first 20 URLs in DOM order — i.e. the nav, which is never broken — so genuine breakage in body content is systematically missed, while WAF 403s, 429s from its own 20-way parallel burst, and legitimately gated 401 pages are printed to the user as broken links to fix. Both error directions at once.

**Required fix:** Sample randomly (or stratify: some nav, some body-content links per page) rather than taking the first 20 in DOM order, and say which strategy was used. Throttle to ~5 concurrent requests and prefer HEAD with a GET fallback. Classify: only 404/410 and 5xx count as broken; 401/403/429/0 report as 'could not verify' and, when `ctx.wafProtection?.isBlocked`, return notApplicable. Add the `isSafeUrl()` guard already used by 1.5. Normalize www/bare host and strip tracking params before deduping.

**False-positive risks:**
- `Array.from(internalUrls).slice(0, 20)` takes insertion order, which is DOM order from the first scanned page — nearly always the header/nav. Broken links in article bodies or footers are never sampled → false PASS. This is not a random sample despite the report saying 'sampled'.
- `broken = results.filter((r) => !isOk(r))` treats 401 (gated account pages), 403 (Cloudflare/Akamai bot challenge against the scanner UA), 429 (rate limit), 410 (intentional), 503 and the fetcher's `status: 0` timeout as broken. `ctx.wafProtection` is available in CheckContext and completely ignored here.
- `Promise.all` over 20 URLs fires 20 simultaneous requests at one origin — a common trigger for exactly the 429/403 responses the audit then reports as the site's own defects.
- Host matching `resolved.hostname === domain || resolved.hostname.endsWith('.'+domain)` misclassifies bare-host links when the scan started at www (and vice versa), so real internal links are skipped as external → 'No internal links found to validate'.
- Query strings are retained while hashes are stripped, so tracking-parameter variants of one page are checked as distinct links, consuming the 20-link budget on duplicates.
- `endsWith('.' + domain)` on an attacker-controlled subdomain also permits fetching a host that resolves to a private IP — this audit, unlike llms-txt-links-valid, performs no `isSafeUrl()` check before fetching.
- `broken.length > urlsToCheck.length / 2` on a 2-link page turns one broken link into a hard FAIL.

**Test gaps:**
- 403/429/401 responses (currently reported as broken links)
- WAF-protected site with ctx.wafProtection set
- status:0 timeout results
- More than 20 internal links, with the broken ones outside the first 20 (false PASS)
- www vs bare-host internal links
- Query-string variants consuming the sample budget
- Redirecting internal links

**Overlaps with:** `1.5`, `1.15`

## Evidence

### Signal: Soft-404 / SPA catch-all rewrite (HTTP 200 for everything) as a false-result source — grade A (technical-infra)

**Mechanism:** A server that returns HTTP 200 with an application shell for URLs that do not exist causes two distinct harms. Crawlers spend capacity on valueless error pages, and may index them. And any automated audit that infers file existence from a 2xx status produces false positives — reporting llms.txt, robots.txt, feeds or .md mirrors as 'present' when the origin merely echoed the SPA shell. FALSIFIABLE FORM: request a guaranteed-nonexistent path; if the response is 2xx with body content resembling the site shell, every existence check on that origin is unreliable until content-based verification is applied.

**Grade: A** — Vendor-documented and verifiable by construction. Google names the failure mode exactly: "When a SPA is using client-side JavaScript to handle errors they often report a 200 HTTP status code instead of the appropriate status code. This can lead to error pages being indexed and possibly shown in search results." The second harm needs no citation at all. A checker that infers a file exists from a 2xx status reports `llms.txt` or a feed as present on a site that serves an application shell for every path — a defect in the measurement itself. What is not documented is any AI vendor's own soft-404 heuristic, so the audit claims wasted fetches, not a ranking penalty.

**Evidence:** Documented vendor behaviour, and additionally verifiable by construction. Google names the exact failure mode: 'When a SPA is using client-side JavaScript to handle errors they often report a 200 HTTP status code instead of the appropriate status code. This can lead to error pages being indexed and possibly shown in search results', with the prescribed fixes being a redirect to a URL that genuinely returns 404, or a robots noindex. Google's status-code reference defines a soft 404 as content that 'suggests an error... an empty page or an error message' returned with a 2xx code. The crawl-budget guide states flatly that 'Soft 404 pages will continue to be crawled, and waste your budget.' Vercel's measurements show AI crawlers are far more exposed to that waste than Googlebot: 34.82% of ChatGPT fetches and 34.16% of Claude fetches land on 404s, against 8.22% for Googlebot. For the audit tool itself the mechanism is not probabilistic at all — a 200-for-everything origin defeats status-based existence probes deterministically, so soft-404 detection must run as a precondition gate before any other file-presence audit is trusted.

**Counter-evidence:** No AI vendor publishes its own soft-404 heuristic. The specific detection thresholds are therefore Google-derived, and the claim that GPTBot or ClaudeBot penalise soft 404s is not directly documented. What is documented is that they waste a third of their fetches on error responses. Detection also has a false-positive risk of its own: a legitimately-configured site may return 200 for a probe path that happens to exist, and some CDNs return 200 with a custom error body by design. The audit should therefore verify via body content (shell fingerprint, absence of expected markers) and not by status code alone, and should report soft-404 as a confidence-degrading condition rather than a page-quality failure.

### Signal: Broken links / high 4xx-5xx rate on internally linked URLs — grade B (discovery-infra)

**Mechanism:** Internal links and sitemap entries pointing at 4xx/5xx URLs consume AI crawl budget on dead fetches and cause task-executing agents to abandon navigation, so reducing them raises the ratio of successful content fetches per crawl. Falsifiable: if a site's AI-crawler 404 rate and citation coverage are unaffected by fixing internal broken links, the claim fails.

**Grade: B** — The best-measured signal in the domain: Vercel and MERJ found ChatGPT spends 34.82% of its fetches on 404 pages and Claude 34.16%, against Googlebot's 8.22%. Roughly a third of all LLM-crawler effort on a site lands on nothing. It stays at B rather than A because of an attribution problem the audit states openly: those figures count URLs the crawlers *requested*, and Oncrawl shows a large share are model-hallucinated or stale-memory paths the site never linked. So the headline number does not isolate the effect of on-site broken links, and the audit claims wasted crawl budget rather than a measured citation loss.

**Evidence:** This is the best-measured signal in the domain. Vercel and MERJ found ChatGPT spends 34.82% of its fetches on 404 pages and 14.36% following redirects, and Claude 34.16% on 404s — against Googlebot's 8.22% and 1.49%. Roughly a third of all LLM-crawler effort on a site is landing on nothing. Apple documents the consequence as vendor policy: "Applebot's crawl rate adjusts automatically when a site slows down or returns errors." It adds that 'Identifying content that doesn't need to be crawled lowers infrastructure costs for site owners'. Error rate directly throttles how much of your site Apple fetches. Oncrawl's production logs show the acute form: 988 ChatGPT-User requests returning 404 concentrated over a few hours on a single retailer. Cloudflare's crawl-to-refer data establishes why the waste matters economically — AI platforms already fetch orders of magnitude more HTML than they refer back, so every dead fetch is pure cost. On the agent side, BrowserArena's live-web evaluation identifies direct URL navigation as one of three consistent failure categories, concluding that current web agents are brittle on real-world navigation.

**Counter-evidence:** Important attribution caveat that must be published with the claim: the Vercel 404 rates measure URLs the crawlers REQUESTED, and Oncrawl shows a large share of those are model-hallucinated or stale-memory paths that the site never linked — 'ChatGPT inventing URLs'. So the headline 34.82% figure does not isolate the effect of on-site broken links, and fixing every internal 404 would not bring it near Googlebot's 8.22%. No study demonstrates that repairing internal broken links raises AI citation rate. Google's nofollow guidance separately notes pages 'may be found through other means', reinforcing that the crawler's URL set is not solely derived from your link graph. The correct scored claim is crawl-efficiency and agent-navigation reliability, not citation lift; serving a proper 404/410 and maintaining redirects is the actionable core.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
