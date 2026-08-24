---
audit: access-crawl-control/ai-crawler-edge-parity
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/ai-crawler-edge-parity.ts
slug: ai-crawler-edge-parity
evidence_grade: A
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-22"
reviewed: 2026-08-20
graduated: 2026-08-22
sources:
  - s14
  - s18
  - openai-searchbot-ips
  - s4
  - s20
  - s21
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

## Merged

`docs/evidence/merged/access-crawl-control/ai-crawler-edge-parity.md` holds the
competitor-gap restatement of this same check, folded into this audit on
2026-08-22 (Plan 5, Task 2). The two sketches described one measurement — paired
per-UA fetches over a sampled URL set — and the `bot-auth-access` one carried
the fuller spec (robots-consistency verdict matrix, block-class taxonomy), so it
is the one that shipped.

## Implementation deviations

- **Probe set is `/`, up to 2 sitemap URLs and `/llms.txt`.** The sketch says
  "2-3 content URLs"; two keeps the request count at 7 per URL (one baseline
  plus six crawler UAs) without a third round of the same measurement.
- **Every probe is memoised per scan** (`sharedUaProbes`), so the three
  UA-parity audits share one baseline and one probe per (URL, crawler) pair
  instead of repeating them.
- **`Google-Extended` is not probed.** It is a robots.txt product token with no
  user agent of its own, so a UA probe for it would compare the site against a
  string that never appears in real traffic. The gatherer documents the same
  exclusion.
- **Findings are grouped by URL and cause**, not listed per crawler. Six
  crawlers hitting one wall is one line naming six crawlers; listing them
  separately filled the message with copies of the homepage and hid the other
  URLs.
- **A generic non-2xx is a hard finding.** The sketch enumerates the decidable
  classes (challenge, 402, proof-of-work, soft block); a plain 503 or 404 to a
  crawler where a browser gets 200 is just as decidable and is reported the same
  way, quoting both statuses.

## Deferred

- **An opaque 403 or 429 is never scored as a failure.** Cloudflare and Akamai
  deliberately block UA-spoofed AI bots arriving from unpublished addresses, and
  the scanner sends the crawler User-Agent without the matching source IP. That
  branch is a warning that names the classification and tells the operator to
  confirm against the edge logs — the honest verdict, not the convenient one.
- **No reverse-DNS or published-CIDR verification.** Fetching from a verified
  crawler address would resolve the ambiguity above, and needs infrastructure
  the scanner does not have.
- **No retry on a rate limit.** A 429 is reported as observed rather than
  waited out; honouring `Retry-After` inside a single audit would stall the scan.
- **The soft-block threshold is fixed at 40% of the baseline main-content
  text**, per the gatherer. A page that legitimately serves less to a crawler —
  a very aggressive cache variant, for instance — reads as a soft block.
