---
audit: agentic-commerce/agent-ua-commerce-parity
category: agentic-commerce
source_file: packages/core/src/audits/agentic-commerce/agent-ua-commerce-parity.ts
slug: agent-ua-commerce-parity
evidence_grade: A
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-22"
reviewed: 2026-08-20
graduated: 2026-08-22
sources:
  - s18
  - openai-searchbot-ips
  - acp-security
---


# Agent User-Agent Fetch Parity on Commerce Paths

> Shipped in v2. Evidence grade **A** · scored tier · unique · implementation: `static-fetch`

## What it checks

Issues paired live requests to PDPs, cart and policy URLs with a baseline browser UA versus each documented OpenAI agent UA, detecting WAF/CDN blocks and bot challenges that robots.txt-only audits are structurally blind to.

## Claimed mechanism (falsifiable)

Falsifiable claim: OpenAI operates four separately-tokened agents with separately published IP ranges — OAI-SearchBot (ChatGPT search indexing), ChatGPT-User (user-initiated fetches, i.e. the shopper's agent), GPTBot (training), OAI-AdsBot (ad landing-page validation). If a PDP returns 403/429/503 or a bot-challenge interstitial to ChatGPT-User or OAI-SearchBot while returning 200 to a browser UA, ChatGPT cannot read live price and availability nor follow the buy link, so the product cannot be surfaced or transacted regardless of feed quality. This block lives at the WAF/CDN edge and is therefore invisible to any audit that only parses robots.txt. Disproof condition: a site 403ing ChatGPT-User on its PDPs still showing live, accurate prices in ChatGPT.

## Evidence

- **[OpenAI Bots / Crawler documentation](https://developers.openai.com/api/docs/bots)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Four distinct user agents with separate robots.txt tokens and separate published IP-range files: OAI-SearchBot (surfaces sites in ChatGPT search — https://openai.com/searchbot.json), OAI-AdsBot (validates ad landing pages — https://openai.com/adsbot.json), GPTBot (model training — https://openai.com/gptbot.json), ChatGPT-User (user-initiated actions: web visits and GPT Actions — https://openai.com/chatgpt-user.json). ChatGPT-User is the agent that fetches on a shopper's behalf. Crucially these are separately controllable: blocking GPTBot does not block OAI-SearchBot or ChatGPT-User, and vice versa.
- **[OAI-SearchBot published IP ranges](https://openai.com/searchbot.json)** — OpenAI (dataset, URL verified 2026-08-20)
  - Live JSON with creationTime (2026-01-02T11:00:00.000000) and a prefixes[] array of 35 IPv4 CIDR blocks (/24 to /28), e.g. 104.210.140.128/28 and 172.182.193.224/28. Machine-consumable, so an auditor can both spoof the documented UA and tell a merchant exactly which ranges to allowlist at the WAF.
- **[ACP Concepts: Security](https://agenticcommerce.dev/docs/concepts/security)** — Agentic Commerce Protocol (spec, URL verified 2026-08-20)
  - All ACP endpoints use HTTPS and send/receive JSON. Bearer-token authentication between agent and seller; sellers retrieve tokens through the agent's application. Mandatory headers: Authorization: Bearer <token>, Content-Type: application/json, Accept: application/json.

## Competitor coverage

Every AI-SEO tool (Semrush AI toolkit, Ahrefs Brand Radar, Otterly) parses robots.txt for GPTBot/ClaudeBot/PerplexityBot strings — that is commodity and we already do it. NOBODY issues the differential live fetch that catches Cloudflare/Akamai/PerimeterX blocking an agent whose robots.txt rules are permissive. Lighthouse's agentic category does not make network requests under alternate user agents at all.

## Implementation sketch

Target set: homepage, 2 sampled PDPs, /cart (platform-fingerprinted), and the terms_of_use + privacy_policy URLs from the link-surface check. For each target issue paired GETs — baseline modern Chrome UA, then `Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot`, then the OAI-SearchBot UA. Fail conditions, evaluated per (target, agent-UA): (a) status class differs from baseline; (b) agent UA gets 403/429/503; (c) body matches challenge fingerprints — 'Just a moment...', cf-chl-, __cf_chl, _Incapsula_, px-captcha, /akam/ ; (d) extracted-text length ratio agent/baseline < 0.6, which catches soft cloaking where a stub page is served. Separately parse robots.txt with correct per-token longest-match semantics for all four OpenAI tokens plus wildcard, and report the ASYMMETRY explicitly: GPTBot disallowed while OAI-SearchBot allowed is an intentional, legitimate posture (opt out of training, stay in search); OAI-SearchBot or ChatGPT-User disallowed on PDP paths is a commerce-fatal misconfiguration. When a block is found, fetch https://openai.com/searchbot.json and https://openai.com/chatgpt-user.json and emit the exact CIDR list the merchant should allowlist. Throttle to <=1 req/s per host and honour Retry-After.

## Example failure

A merchant sets `User-agent: * / Allow: /` and passes every robots.txt audit, but its Cloudflare Bot Fight Mode returns a 403 'Just a moment...' interstitial to ChatGPT-User. The site scores 100 on competitor AI-readiness tools while ChatGPT literally cannot open any product page. Second pattern: robots.txt blocks GPTBot only, but the WAF rule was written against a substring match on 'GPT' and therefore also blocks nothing visible in robots.txt while silently 429ing OAI-SearchBot.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

Recorded at graduation (2026-08-22, Plan 5 Task 25).

- **Per-host throttling and `Retry-After` are not implemented.** The sketch asked for at most 1 request per second per host with `Retry-After` honoured. A sleep inside a single audit serialises the whole scan, because every audit shares one scan budget and the live-site verification suite cannot absorb the added wall-clock. The paired probes instead go through the shared `sharedUaProbes` cache in `packages/core/src/gatherers/ua-parity.ts`, so each (URL, User-Agent) pair is fetched at most once per scan and the audits that need the same probes reuse them.
- **The two OpenAI CIDR endpoints are named, never fetched.** `https://openai.com/searchbot.json` and `https://openai.com/chatgpt-user.json` appear in the failure message and in the fix guidance as the sources the operator should allowlist from. Fetching them would add two off-site requests per scan and would tell the audit nothing it can act on, since the scanner is not the agent whose address matters.
- **Two of the four OpenAI tokens are probed.** OAI-SearchBot and ChatGPT-User are the two a purchase depends on. GPTBot is read from robots.txt only, and OAI-AdsBot is out of scope: a paid-ads landing-page validator is not on the organic commerce path.
- **The GPTBot posture is reported, never scored.** `Disallow` for GPTBot while OAI-SearchBot stays allowed is the documented way to opt out of training without leaving search. The audit appends a sentence naming it and takes nothing off the score, on a pass or a fail.
- **Blocking is decided by one reason per probe, in fixed order**: a challenge-body fingerprint first, then an HTTP status class mismatch, then an extracted-text ratio under 0.6. One target therefore contributes at most one finding per agent, so a Cloudflare interstitial is not also counted as a text-ratio failure.

## Deferred

- Per-host rate limiting with `Retry-After` support, if the scanner ever grows a shared request scheduler that all audits go through.
- OAI-AdsBot probing, which would only matter for a site that runs paid placements into ChatGPT.
- Fetching and diffing the published CIDR ranges against the site's observed edge behaviour. That needs the scan to run from a known address, which it does not.
