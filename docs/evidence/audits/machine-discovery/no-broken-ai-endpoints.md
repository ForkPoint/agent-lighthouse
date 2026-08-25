---
audit: machine-discovery/no-broken-ai-endpoints
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/no-broken-ai-endpoints.ts
slug: no-broken-ai-endpoints
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: scored
consumers:
  - Cloudflare AI Crawl Control / Bot Management
  - site-operator WAF rules
  - GPTBot
  - ClaudeBot
  - PerplexityBot (as blocked parties)
signals:
  - name: Soft-404 / SPA catch-all rewrite (HTTP 200 for everything) as a false-result source
    grade: A
    domain: technical-infra
  - name: "WAF / bot-management blocking AI agents (Cloudflare AI Crawl Control, default blocks, pay-per-crawl 402)"
    grade: A
    domain: technical-infra
sources:
  - google-fix-search-javascript
  - google-http-status-codes
  - google-crawl-budget-docs
  - vercel-rise-of-ai-crawler
  - s21
  - cloudflare-pay-per-crawl
  - cloudflare-content-independence-day
  - cloudflare-ai-options-2026
  - cloudflare-googlebot-to-gptbot-2025
  - cloudflare-perplexity-stealth-crawlers
  - cloudflare-web-bot-auth
  - cloudflare-crawl-refer-ratio
  - s2
---

# no-broken-ai-endpoints (`8.18`)

> technical-readiness · source `no-broken-ai-endpoints.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

AI agents follow URLs in your ai-catalog.json, llms.txt, and navigation.json to build a map of your site's AI-consumable resources. Broken links cause agents to lose trust in your manifest files entirely, potentially ignoring all listed endpoints. Fix or remove broken URLs.

## Code review findings (2026-08-20, 11-agent pass)

Genuinely valuable signal — a llms.txt full of 404s does degrade agent trust — and the Markdown-link extraction has clearly been hardened once already (the comment documents the old `/https?:\/\/[^\s)>]+/g` regex fabricating phantom endpoints). But a broad bare-URL sweep was left in alongside it, and the audit still validates every URL it finds regardless of whose domain it belongs to. The result is that third-party links — the schema.org, GitHub, or docs URLs that legitimately appear in an llms.txt — get HEAD/GET-probed by a bot user agent, get 403'd by their own Cloudflare, and are then reported to the user as 'AI endpoint URLs are broken' on the user's site, at priority `high`. Combined with the SPA soft-404 case it is a reliable false-failure generator.

**Required fix:** Restrict validation to same-origin URLs by default (report off-origin links separately as informational, never as a site failure). Drop the bare-URL sweep in favor of the already-integrated `extractMarkdownLinks`, or gate the sweep on the body actually looking like text/markdown rather than HTML. Treat 401/403 as `warn: auth-gated, not broken` rather than broken. Apply `slice(0, 20)` AFTER the safety filter and state the truncation in the result message. Handle protocol-relative and non-http schemes in the navigation.json walker before concatenating onto baseUrl. Serialize or throttle the probes instead of firing all 20 through `Promise.all`.

**False-positive risks:**
- Third-party URLs judged as the site's own defects: no same-origin filter. `urlsToCheck` accepts any absolute URL from llms.txt. External links that 403 bot UAs (Cloudflare-fronted docs, LinkedIn, Twitter/X, many vendor sites) or that rate-limit are reported as the site's broken AI endpoints.
- Soft-404 amplification: when an SPA host serves index.html with 200 for /llms.txt, the bare-URL sweep `llmsTxt.body.match(/https?:\/\/[^\s)\]>`"']+/g)` harvests every absolute href in that HTML — analytics, CDN, social, font origins — and probes up to 20 of them, near-guaranteeing a broken-endpoint verdict about a file that does not exist.
- Auth-gated endpoints counted as broken: a real MCP or API endpoint answering 401/403 to an unauthenticated probe is `>= 400` ⇒ broken. The JSON-RPC POST rescue only fires for URLs containing '/mcp' or '/api/', so an MCP server at /agent or /rpc is mis-flagged.
- HEAD-hostile origins: `HEAD` first, `GET` on `>= 400` — good — but hosts that return 405 to HEAD *and* rate-limit the immediate GET retry still land as broken; there is no backoff and all URLs are probed concurrently via `Promise.all`, which can trip the target's own rate limiter and manufacture failures.
- Silent truncation: `Array.from(urlsToCheck).slice(0, 20)` is applied BEFORE the `isSafeUrl` filter, so a manifest with 100 links has 80 silently unchecked and the pass message ('All N AI endpoint URL(s) are reachable') overstates coverage.
- navigation.json recursion grabs any `url`/`href` key at any depth including non-endpoint metadata, and `value.startsWith('http')` treats a protocol-relative `//cdn…` or a mailto:/tel: value as relative and concatenates it onto baseUrl, producing a nonsense URL that then reports as broken.
- navigation.json itself has essentially no adoption (see obsolete note), so a third of the input surface is speculative.

**Test gaps:**
- No test with an external/third-party URL in llms.txt (the top false-positive source).
- No test where llms.txt is actually the SPA HTML fallback.
- No test for a 401/403 auth-gated endpoint that is healthy.
- No test for a 405-on-HEAD host.
- No test for >20 URLs (truncation is invisible and the pass message is misleading).
- No test for protocol-relative `//host/path` or `mailto:` values in navigation.json.
- No test for the MCP JSON-RPC POST rescue path on a URL that does not contain '/mcp' or '/api/'.

**Overlaps with:** _none_

## Evidence

### Signal: Soft-404 / SPA catch-all rewrite (HTTP 200 for everything) as a false-result source — grade A (technical-infra)

**Mechanism:** A server that returns HTTP 200 with an application shell for URLs that do not exist causes two distinct harms. Crawlers spend capacity on valueless error pages, and may index them. And any automated audit that infers file existence from a 2xx status produces false positives — reporting llms.txt, robots.txt, feeds or .md mirrors as 'present' when the origin merely echoed the SPA shell. Falsifiable form: request a guaranteed-nonexistent path; if the response is 2xx with body content resembling the site shell, every existence check on that origin is unreliable until content-based verification is applied.

**Grade: A** — Vendor-documented and verifiable by construction. Google names the failure mode exactly: "When a SPA is using client-side JavaScript to handle errors they often report a 200 HTTP status code instead of the appropriate status code. This can lead to error pages being indexed and possibly shown in search results." The second harm needs no citation at all. A checker that infers a file exists from a 2xx status reports `llms.txt` or a feed as present on a site that serves an application shell for every path — a defect in the measurement itself. What is not documented is any AI vendor's own soft-404 heuristic, so the audit claims wasted fetches, not a ranking penalty.

**Evidence:** Documented vendor behaviour, and additionally verifiable by construction. Google names the exact failure mode: 'When a SPA is using client-side JavaScript to handle errors they often report a 200 HTTP status code instead of the appropriate status code. This can lead to error pages being indexed and possibly shown in search results', with the prescribed fixes being a redirect to a URL that genuinely returns 404, or a robots noindex. Google's status-code reference defines a soft 404 as content that 'suggests an error... an empty page or an error message' returned with a 2xx code. The crawl-budget guide states flatly that 'Soft 404 pages will continue to be crawled, and waste your budget.' Vercel's measurements show AI crawlers are far more exposed to that waste than Googlebot: 34.82% of ChatGPT fetches and 34.16% of Claude fetches land on 404s, against 8.22% for Googlebot. For the audit tool itself the mechanism is not probabilistic at all — a 200-for-everything origin defeats status-based existence probes deterministically, so soft-404 detection must run as a precondition gate before any other file-presence audit is trusted.

**Counter-evidence:** No AI vendor publishes its own soft-404 heuristic. The specific detection thresholds are therefore Google-derived, and the claim that GPTBot or ClaudeBot penalise soft 404s is not directly documented. What is documented is that they waste a third of their fetches on error responses. Detection also has a false-positive risk of its own: a legitimately-configured site may return 200 for a probe path that happens to exist, and some CDNs return 200 with a custom error body by design. The audit should therefore verify via body content (shell fingerprint, absence of expected markers) and not by status code alone, and should report soft-404 as a confidence-degrading condition rather than a page-quality failure.

### Signal: WAF / bot-management blocking AI agents (Cloudflare AI Crawl Control, default blocks, pay-per-crawl 402) — grade A (technical-infra)

**Mechanism:** Edge bot-management sitting in front of the origin can deny AI crawlers and agents outright, or gate them behind payment, so a site with perfect content structure can still be entirely invisible to AI systems. Falsifiable form: fetch the same URL with an AI-crawler User-Agent versus a browser User-Agent; divergent status codes (403 / 401 / 402 / challenge page for the former) prove an access gate independent of content quality.

**Grade: A** — Vendor-documented at a scale that changes the default posture of the web. Cloudflare began blocking AI crawlers by default for new domains on 1 July 2025. It has announced that from 15 September 2026, new domains on ad-displaying sites block Training and Agent class bots by default. A named intermediary publishing what it blocks, and when, is well past the grade-A bar — a site with perfect structure can be entirely invisible behind it. How it is audited is deliberately narrow, because User-Agent probing is unreliable in both directions: Cloudflare documented Perplexity impersonating Chrome from unlisted IPs at 3–6M requests a day, and scrapers routinely spoof GPTBot.

**Evidence:** Fully documented vendor behaviour at large scale. Cloudflare began blocking AI crawlers by default for new domains on 1 July 2025, making permission the default posture across a very large share of the web. It has since announced a change for 15 September 2026. New domains will block 'Training' and 'Agent' class bots by default on ad-displaying pages, while leaving 'Search' allowed, and has extended managed robots.txt with a `use` signal (immediate / reference / full). Pay-per-crawl operationalises the gate in HTTP. Crawlers 'either present payment intent via request headers for successful HTTP 200 access, or receive an HTTP 402 Payment Required response with pricing', at a minimum of $0.001 per crawl. Critically, an existing WAF or Bot Management block rule overrides pay-per-crawl's charge behaviour, and silently converts a monetizable crawl into a hard block. Adoption context: of 3,816 top-10k domains with robots.txt, ~14% carried AI-bot directives; GPTBot was the most-disallowed at 312 domains. Verification is moving to cryptography — Cloudflare's Web Bot Auth implements RFC 9421 HTTP Message Signatures with Signature-Input / Signature / Signature-Agent headers and a JWKS key directory at /.well-known/http-message-signatures-directory.

**Counter-evidence:** Two caveats that shape how this must be audited. (1) User-Agent-based probing is unreliable in both directions: Cloudflare documented Perplexity using a Chrome-impersonating stealth crawler on unlisted IPs across rotating ASNs at 3–6M requests/day to evade no-crawl directives, and conversely malicious scrapers routinely spoof GPTBot. An audit that merely sets a UA header measures the WAF's UA rules, not real agent access — genuine verification requires the vendors' published IP ranges (openai.com/gptbot.json, claude.com/crawling/bots.json, perplexity.com/perplexitybot.json) or Web Bot Auth signatures. (2) Blocking is often a deliberate, rational business decision, not a defect. Cloudflare's crawl-to-refer data puts Anthropic at about 71,000 crawls per HTML referral in the June 2025 window, with the caveat that Claude's native app sends no Referer. That makes uncompensated crawl a real cost. The audit should REPORT the gate neutrally as 'AI agents are blocked here' rather than scoring it as a failure, since the site owner may have chosen it.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
