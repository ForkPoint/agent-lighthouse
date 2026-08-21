---
check: ai-crawler-edge-response-parity
title: "AI crawler edge-response parity"
domain: bot-auth-access
status: proposed
evidence_grade: A
uniqueness: partial-overlap
difficulty: multi-page
scoring_tier: scored
reviewed: 2026-08-20
---

# AI crawler edge-response parity

> Proposed check. Evidence grade **A** · partial overlap · implementation: `multi-page`

## What it checks

Detects the single most common and most invisible AI-visibility failure: robots.txt grants an AI crawler access, but the CDN/WAF in front of the origin answers that crawler with a challenge, a 403, a 402, or a proof-of-work interstitial. The site owner reads their own robots.txt and believes they are open; the crawler never sees a byte.

## Claimed mechanism (falsifiable)

robots.txt (RFC 9309) is advisory metadata parsed by the crawler; the edge access decision is enforced independently by the WAF. Therefore a site can simultaneously publish `User-agent: PerplexityBot / Allow: /` and return a non-200 to every request carrying that user-agent. Falsifiable: fetch URL U with a browser UA and with crawler UA C; if robots.txt permits C for U and the C-request status is not 2xx while the browser-request is 200, the two policy layers contradict each other. Cloudflare makes one branch deterministically classifiable: a challenge response always carries `cf-mitigated: challenge` and `content-type: text/html` (s14).

## Evidence

- **[Detect a Challenge Page response (cf-mitigated)](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/challenge-pages/detect-response/)** — Cloudflare (vendor-doc, URL verified 2026-08-20)
  - Exact header is `cf-mitigated`; "challenge is the only valid value"; "The header is set for all Challenge Page types." Also: "regardless of the requested resource-type, the content-type of a challenge will be text/html". Gives a deterministic, vendor-documented way for an auditor to distinguish "you were challenged" from "you were served content" or "you hit an ordinary 403".
- **[OpenAI crawlers and user agents](https://developers.openai.com/api/docs/bots)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Exact UA strings and published IP-range JSONs. OAI-SearchBot (…compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot) → https://openai.com/searchbot.json. GPTBot (…compatible; GPTBot/1.4; +https://openai.com/gptbot) → https://openai.com/gptbot.json. ChatGPT-User (…compatible; ChatGPT-User/1.0; +https://openai.com/bot) → https://openai.com/chatgpt-user.json. OAI-AdsBot → https://openai.com/adsbot.json. All four JSON endpoints return HTTP 200 (curl-verified). No mention of Web Bot Auth. Note Google-Extended has no UA at all, so it cannot be probed by request.
- **[Verified bots policy — Cloudflare](https://developers.cloudflare.com/bots/concepts/bot/verified-bots/policy/)** — Cloudflare (vendor-doc, URL verified 2026-08-20)
  - Two requirements for verified status: (1) "Honest self-identification — it declares who it is deterministically, through a cryptographic Web Bot Auth signature, a published IP list with a stable user-agent, or reverse DNS." (2) "Non-abusive behavior — it obeys robots.txt and crawl directives...". Establishes that UA-string alone is never trusted, which is the source of the false-positive ambiguity when auditing edge blocks by UA spoofing.
- **[Anubis (proof-of-work interstitial)](https://anubis.techaro.lol/docs/design/why-proof-of-work/)** — Techaro (vendor-doc, URL verified 2026-08-20)
  - URL resolves but served an Anubis deny page rather than the doc — which itself confirmed the fingerprints an auditor needs: asset paths under `/.within.website/x/cmd/anubis/`, body text "Access Denied: error code <hex>", footer "Protected by Anubis From Techaro", and a version banner (v1.27.1-…). Treat as a fingerprint source, not as a cited spec; re-verify the doc URL before shipping it in remediation copy.
- **[AI Crawl Control — Cloudflare](https://developers.cloudflare.com/ai-crawl-control/)** — Cloudflare (vendor-doc, URL verified 2026-08-20)
  - "Works automatically on all Cloudflare plans"; operators "Set allow or block rules for individual crawlers" and monitor AI access. Default-block posture and blocked-crawler response codes are NOT documented on this page — so an auditor must not assert Cloudflare's default behaviour, only measure the observed response.

## Competitor coverage

Lighthouse's Agentic Browsing category does not issue any second request under an alternate UA. Ahrefs/Semrush check whether robots.txt blocks AI bots (commodity) but never test whether the edge agrees with robots.txt. Dark Visitors reports crawler hits from server logs — it can only see crawlers that got through, so it is blind to exactly this failure. Agent Lighthouse's existing no-bot-detection audit is script-pattern-based (Turnstile/DataDome/reCAPTCHA strings in HTML) plus a coarse wafProtection flag; this replaces the guess with a per-crawler measured outcome and a documented challenge-header classifier.

## Implementation sketch

1) Fetch /robots.txt with a neutral UA and parse per-agent groups (reuse _robots-txt-helpers). 2) Build a probe set: `/`, plus 2-3 content URLs sampled from sitemap.xml, plus /llms.txt if present. 3) For each probe URL, fetch with a baseline modern-Chrome UA, then with each published crawler UA string verbatim from vendor docs — GPTBot/1.4, OAI-SearchBot/1.4, ChatGPT-User/1.0 (s18), ClaudeBot, Claude-User, PerplexityBot. Exclude Google-Extended: it is a robots.txt token with no user agent and cannot be probed. Keep identical Accept/Accept-Encoding headers across baseline and probe so only the UA varies. 4) Classify every non-2xx: `cf-mitigated: challenge` → Cloudflare challenge; 402 + `crawler-price` → pay-per-crawl (hand off to the 402 check); body contains `/.within.website/x/cmd/anubis/` or `Protected by Anubis` → PoW wall (s20); 429 → rate limit; 403 with `server: cloudflare` and no cf-mitigated → opaque WAF block. 5) Also classify soft blocks: status 200 but extracted main-text length < 40% of baseline. 6) Verdict matrix: robots-allows AND non-2xx → fail; robots-disallows AND non-2xx → pass (consistent); robots-allows AND 2xx → pass. 7) CRITICAL ambiguity handling: per s4, Cloudflare and Akamai deliberately block UA-spoofed AI bots arriving from unpublished IPs, so an opaque 403 cannot distinguish 'you block AI crawlers' from 'you correctly block impersonators'. Score cf-mitigated challenges, 402s, Anubis walls and soft-block truncation as hard failures; report opaque 403/429 as a warning that names the classification and tells the operator to confirm against edge logs. Report per-crawler, per-URL, never a single site-wide boolean.

## Example failure

robots.txt contains `User-agent: PerplexityBot` / `Allow: /`. `GET /pricing` with a Chrome UA returns 200 and 4,100 chars of main text; the identical request with `PerplexityBot` returns 403 with `cf-mitigated: challenge` and `content-type: text/html`. Perplexity can never quote the pricing page, and nothing in the site's own configuration reveals this.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
