---
audit: access-crawl-control/ai-crawler-edge-parity
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/ai-crawler-edge-parity.ts
slug: ai-crawler-edge-parity
evidence_grade: A
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-22"
reviewed: 2026-10-19
graduated: 2026-08-22
sources:
  - s14
  - s18
  - openai-searchbot-ips
  - s4
  - s20
  - s21
  - cloudflare-pay-per-crawl
  - cloudflare-content-independence-day
  - cloudflare-ai-options-2026
  - cloudflare-googlebot-to-gptbot-2025
  - cloudflare-perplexity-stealth-crawlers
  - cloudflare-web-bot-auth
  - cloudflare-crawl-refer-ratio
  - anthropic-crawlers
  - perplexity-crawlers-doc
  - chromium-dash-stable
---

# AI crawler edge-response parity

> Shipped in v2. Evidence grade **A** · scored tier · partial overlap · implementation: `multi-page`

## What it checks

Detects the single most common and most invisible AI-visibility failure: robots.txt grants an AI crawler access, but the CDN/WAF in front of the origin answers that crawler with a challenge, a 403, a 402, or a proof-of-work interstitial. The site owner reads their own robots.txt and believes they are open; the crawler never sees a byte.

## Claimed mechanism (falsifiable)

robots.txt (RFC 9309) is advisory metadata parsed by the crawler; the edge access decision is enforced independently by the WAF. Therefore a site can simultaneously publish `User-agent: PerplexityBot / Allow: /` and return a non-200 to every request carrying that user-agent. Falsifiable: fetch URL U with a browser UA and with crawler UA C; if robots.txt permits C for U and the C-request status is not 2xx while the browser-request is 200, the two policy layers contradict each other. Cloudflare makes one branch deterministically classifiable: a challenge response always carries `cf-mitigated: challenge` and `content-type: text/html` (s14).

## Evidence

- **[Detect a Challenge Page response (cf-mitigated)](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/challenge-pages/detect-response/)** — Cloudflare (vendor-doc, URL verified 2026-08-20)
  - Exact header is `cf-mitigated`; "challenge is the only valid value"; "The header is set for all Challenge Page types." Also: "regardless of the requested resource-type, the content-type of a challenge will be text/html". Gives a deterministic, vendor-documented way for an auditor to distinguish "you were challenged" from "you were served content" or "you hit an ordinary 403".
- **[OpenAI crawlers and user agents](https://developers.openai.com/api/docs/bots)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Exact UA strings and published IP-range JSONs (re-verified 2026-10-19). OAI-SearchBot (`Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) … Chrome/131.0.0.0 Safari/537.36; compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot`) → https://openai.com/searchbot.json. GPTBot (…compatible; GPTBot/1.4; +https://openai.com/gptbot) → https://openai.com/gptbot.json. ChatGPT-User (…compatible; ChatGPT-User/1.0; +https://openai.com/bot) → https://openai.com/chatgpt-user.json. OAI-AdsBot → https://openai.com/adsbot.json. All four JSON endpoints return HTTP 200 (curl-verified). No mention of Web Bot Auth. Note Google-Extended has no UA at all, so it cannot be probed by request.
- **[Verified bots policy — Cloudflare](https://developers.cloudflare.com/bots/concepts/bot/verified-bots/policy/)** — Cloudflare (vendor-doc, URL verified 2026-08-20)
  - Two requirements for verified status: (1) "Honest self-identification — it declares who it is deterministically, through a cryptographic Web Bot Auth signature, a published IP list with a stable user-agent, or reverse DNS." (2) "Non-abusive behavior — it obeys robots.txt and crawl directives...". Establishes that UA-string alone is never trusted, which is the source of the false-positive ambiguity when auditing edge blocks by UA spoofing.
- **[Anubis (proof-of-work interstitial)](https://anubis.techaro.lol/docs/design/why-proof-of-work/)** — Techaro (vendor-doc, URL verified 2026-08-20)
  - The URL resolves, but served an Anubis deny page rather than the doc. That page itself confirmed the fingerprints an auditor needs: asset paths under `/.within.website/x/cmd/anubis/`, body text "Access Denied: error code <hex>", the footer "Protected by Anubis From Techaro", and a version banner (v1.27.1-…). Treat as a fingerprint source, not as a cited spec; re-verify the doc URL before shipping it in remediation copy.
- **[AI Crawl Control — Cloudflare](https://developers.cloudflare.com/ai-crawl-control/)** — Cloudflare (vendor-doc, URL verified 2026-08-20)
  - "Works automatically on all Cloudflare plans"; operators "Set allow or block rules for individual crawlers" and monitor AI access. Default-block posture and blocked-crawler response codes are not documented on this page — so an auditor must not assert Cloudflare's default behaviour, only measure the observed response.

### Signal: WAF / bot-management blocking AI agents (Cloudflare AI Crawl Control, default blocks, pay-per-crawl 402) — grade A (technical-infra)

This signal moved here from `https-enabled` on 2026-10-18.

**Mechanism:** Edge bot-management sitting in front of the origin can deny AI crawlers and agents outright, or gate them behind payment, so a site with perfect content structure can still be entirely invisible to AI systems. Falsifiable form: fetch the same URL with an AI-crawler User-Agent versus a browser User-Agent; divergent status codes (403 / 401 / 402 / challenge page for the former) prove an access gate independent of content quality.

**Grade: A** — Cloudflare documents the behaviour at scale and by date. It began blocking AI crawlers by default for new domains on 1 July 2025. It has announced that from 15 September 2026, new domains on ad-displaying plans will block Training and Agent class bots by default. That is a named intermediary documenting exactly what it does to the traffic this audit is about, which is grade A. Two caveats shape how it can be measured, rather than whether it is true. User-agent probing is unreliable in both directions: Perplexity was documented using a Chrome-impersonating stealth crawler, and scrapers routinely spoof GPTBot. An opaque block therefore cannot be told apart from correct impersonation defence.

**Evidence:** Fully documented vendor behaviour at large scale. Cloudflare began blocking AI crawlers by default for new domains on 1 July 2025, making permission the default posture across a very large share of the web. It has since announced that from 15 September 2026 new domains will block 'Training' and 'Agent' class bots by default on ad-displaying pages while leaving 'Search' allowed, and has extended managed robots.txt with a `use` signal (immediate / reference / full). Pay-per-crawl operationalises the gate in HTTP. Crawlers 'either present payment intent via request headers for successful HTTP 200 access, or receive an HTTP 402 Payment Required response with pricing', at a minimum of $0.001 per crawl. Critically, an existing WAF or Bot Management block rule overrides pay-per-crawl's charge behaviour, and silently converts a monetizable crawl into a hard block. Adoption context: of 3,816 top-10k domains with robots.txt, ~14% carried AI-bot directives; GPTBot was the most-disallowed at 312 domains. Verification is moving to cryptography — Cloudflare's Web Bot Auth implements RFC 9421 HTTP Message Signatures with Signature-Input / Signature / Signature-Agent headers and a JWKS key directory at /.well-known/http-message-signatures-directory.

**Counter-evidence:** Two caveats that shape how this must be audited. (1) User-Agent-based probing is unreliable in both directions: Cloudflare documented Perplexity using a Chrome-impersonating stealth crawler on unlisted IPs across rotating ASNs at 3–6M requests/day to evade no-crawl directives, and conversely malicious scrapers routinely spoof GPTBot. An audit that merely sets a UA header measures the WAF's UA rules, not real agent access — genuine verification requires the vendors' published IP ranges (openai.com/gptbot.json, claude.com/crawling/bots.json, perplexity.com/perplexitybot.json) or Web Bot Auth signatures. (2) Blocking is often a deliberate, rational business decision, not a defect. Cloudflare's crawl-to-refer data puts Anthropic at about 71,000 crawls per HTML referral in the June 2025 window, with the caveat that Claude's native app sends no Referer. That makes uncompensated crawl a real cost. The audit should REPORT the gate neutrally as 'AI agents are blocked here' rather than scoring it as a failure, since the site owner may have chosen it.

## Example failure

robots.txt contains `User-agent: PerplexityBot` / `Allow: /`. `GET /pricing` with a Chrome UA returns 200 and 4,100 chars of main text; the identical request with `PerplexityBot` returns 403 with `cf-mitigated: challenge` and `content-type: text/html`. Perplexity can never quote the pricing page, and nothing in the site's own configuration reveals this.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Implementation deviations

- The probe set is `/`, up to 2 sitemap URLs and `/llms.txt`. The sketch said 2-3 content URLs.
- Sitemap URLs come from the shared sitemap gatherer. On a subpath homepage it keeps only same-origin URLs under that directory.
- Every probe is memoised per scan (`sharedUaProbes`). The UA-parity audits share one baseline and one probe per (URL, crawler) pair.
- `Google-Extended` is not probed. It is a robots.txt token with no user agent of its own.
- Findings are grouped by URL and cause, not listed per crawler.
- A generic non-2xx where a browser gets 200 is a hard finding, quoting both statuses.
- An opaque 403 or 429 is a warning, never a failure. The scanner sends the crawler User-Agent without the matching source IP, so it cannot tell a block from impersonation defence.
- OAI-SearchBot is sent as `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36; compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot`, the example OpenAI gives (https://developers.openai.com/api/docs/bots, verified 2026-10-19). Before 2026-10-19 the probe sent a bare `OAI-SearchBot/1.0` string that OpenAI does not document. GPTBot and ChatGPT-User match the same page.
- PerplexityBot is sent as the full string Perplexity documents (https://docs.perplexity.ai/docs/resources/perplexity-crawlers, verified 2026-10-19).
- The ClaudeBot and Claude-User strings are observed, not vendor-documented. Anthropic's crawler page names both tokens but publishes no User-Agent string (https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler, verified 2026-10-19). A finding for either reports how the site answers a request that carries that observed string.
- The browser baseline is a Mac Chrome UA on the current Stable major, 155 (https://chromiumdash.appspot.com/fetch_releases?channel=Stable&platform=Mac&num=1, verified 2026-10-19). It was Chrome 140 before 2026-10-19.

## Deferred

- **No reverse-DNS or published-CIDR verification.** Fetching from a verified
  crawler address would resolve the 403/429 ambiguity, and needs infrastructure
  the scanner does not have.
- **No retry on a rate limit.** A 429 is reported as observed. Honouring
  `Retry-After` inside a single audit would stall the scan.
- **The soft-block threshold is fixed at 40% of the baseline main-content
  text.** A page that legitimately serves less to a crawler reads as a soft
  block.

## Review history

- **2026-10-18:** the WAF / bot-management signal (grade A) and its Cloudflare
  sources moved here from `access-crawl-control/https-enabled`. This audit is
  the one that measures the edge answer per crawler user agent. The grade
  here was already A; it does not change.
