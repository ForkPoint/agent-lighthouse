---
audit: agentic-commerce/agent-ua-commerce-parity
category: agentic-commerce
source_file: packages/core/src/audits/agentic-commerce/agent-ua-commerce-parity.ts
slug: agent-ua-commerce-parity
evidence_grade: A
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-22"
reviewed: 2026-10-19
graduated: 2026-08-22
sources:
  - s18
  - openai-searchbot-ips
  - acp-security
  - chromium-dash-stable
  - s4
  - google-verify-requests
  - cloudflare-fake-bot-rules
---

# Agent User-Agent Fetch Parity on Commerce Paths

> Shipped in v2. Evidence grade **A** · scored tier · unique · implementation: `static-fetch`

## What it checks

Issues paired live requests with a browser User-Agent and with two OpenAI agent User-Agents: ChatGPT-User and OAI-SearchBot. These are the two agents a purchase depends on. GPTBot is a training crawler and is read from robots.txt only. OAI-AdsBot visits only pages submitted as ads, so it is not probed.

The targets are the homepage, the first two scanned pages, `/cart`, and the linked terms and privacy pages. The two sampled pages are not filtered by page type. A probe fails on a bot-challenge marker in the body, a 403, 429 or 503 status, a status class that differs from the browser's, or under 60% of the browser's text. robots.txt is also read: a rule that disallows either agent on a sampled page or the cart fails the audit. These blocks live at the WAF or CDN edge, where a robots.txt-only audit cannot see them.

## Claimed mechanism (falsifiable)

Falsifiable claim: OpenAI operates four separately-tokened agents with separately published IP ranges — OAI-SearchBot (ChatGPT search indexing), ChatGPT-User (user-initiated fetches, i.e. the shopper's agent), GPTBot (training), OAI-AdsBot (ad landing-page validation). A PDP may return 403, 429, 503 or a bot-challenge interstitial to ChatGPT-User or OAI-SearchBot, while returning 200 to a browser UA. ChatGPT then cannot read live price and availability, and cannot follow the buy link. The product cannot be surfaced or transacted, whatever the feed quality. This block lives at the WAF/CDN edge and is therefore invisible to any audit that only parses robots.txt. Disproof condition: a site 403ing ChatGPT-User on its PDPs still showing live, accurate prices in ChatGPT.

## Evidence

- **[OpenAI Bots / Crawler documentation](https://developers.openai.com/api/docs/bots)** — OpenAI (vendor-doc, verified 2026-10-17)
  - Four distinct user agents with separate robots.txt tokens and separate published IP-range files: OAI-SearchBot (surfaces sites in ChatGPT search — https://openai.com/searchbot.json), OAI-AdsBot (validates ad landing pages — https://openai.com/adsbot.json), GPTBot (model training — https://openai.com/gptbot.json), ChatGPT-User (user-initiated actions: web visits and GPT Actions — https://openai.com/chatgpt-user.json). ChatGPT-User is the agent that fetches on a shopper's behalf. Crucially these are separately controllable: blocking GPTBot does not block OAI-SearchBot or ChatGPT-User, and vice versa.
- **[OAI-SearchBot published IP ranges](https://openai.com/searchbot.json)** — OpenAI (dataset, URL verified 2026-08-20)
  - Live JSON with creationTime (2026-01-02T11:00:00.000000) and a prefixes[] array of 35 IPv4 CIDR blocks (/24 to /28), e.g. 104.210.140.128/28 and 172.182.193.224/28. Machine-consumable, so an auditor can both spoof the documented UA and tell a merchant exactly which ranges to allowlist at the WAF.
- **[ACP Concepts: Security](https://agenticcommerce.dev/docs/concepts/security)** — Agentic Commerce Protocol (spec, URL verified 2026-08-20)
  - All ACP endpoints use HTTPS and send/receive JSON. Bearer-token authentication between agent and seller; sellers retrieve tokens through the agent's application. Mandatory headers: Authorization: Bearer <token>, Content-Type: application/json, Accept: application/json.

## Limits

- Every probe leaves the scanner's own address with an OpenAI agent's name in the User-Agent. It shows how the site answers a request that names the OpenAI agent. It does not show what the real OpenAI agent receives.
- Real bots are told apart by network or signature, not by the string. Cloudflare grants verified status to a bot that "declares who it is deterministically, through a cryptographic Web Bot Auth signature, a published IP list with a stable user-agent, or reverse DNS" ([Cloudflare verified bots policy](https://developers.cloudflare.com/bots/concepts/bot/verified-bots/policy/) (verified 2026-10-19)). OpenAI publishes one IP-range file per bot, for example https://openai.com/gptbot.json and https://openai.com/chatgpt-user.json ([OpenAI crawlers and user agents](https://developers.openai.com/api/docs/bots) (verified 2026-10-19)). Google, whose crawlers this audit does not probe, illustrates the same rule: it documents a reverse-DNS check, or a match against its published IP ranges ([Verifying Google crawlers and fetchers](https://developers.google.com/crawling/docs/crawlers-fetchers/verify-google-requests) (verified 2026-10-19)). The scanner can present none of these.
- A CDN block of a request naming an OpenAI agent is ambiguous evidence. Without a signature, a published IP list or reverse DNS, the request is by definition not the verified bot ([Cloudflare verified bots policy](https://developers.cloudflare.com/bots/concepts/bot/verified-bots/policy/) (verified 2026-10-19)), so an edge may treat it as unknown automated traffic. Cloudflare does ship managed rules that flag an unverified request naming Googlebot or Bingbot as a fake bot ([Cloudflare fake bot managed rules](https://developers.cloudflare.com/waf/troubleshooting/fake-bot-managed-rules/) (verified 2026-10-19)). It documents no such rule for AI crawlers, and the scanner never sends either of those names. The analogy shows the mechanism exists. It is not evidence about the bots probed here. A refusal is consistent with the real bot being refused too. It does not prove it.
- A pass does not prove access either. A rule keyed on the verified bot's identity rather than its string can refuse the real bot and still let the probe through.
- OpenAI tells merchants to allowlist its published ranges, and this audit's fix says the same. A merchant who follows that advice admits the real agent and may still refuse the probe.

## Example failure

A merchant sets `User-agent: * / Allow: /` and passes every robots.txt audit, but its Cloudflare Bot Fight Mode returns a 403 'Just a moment...' interstitial to ChatGPT-User. The site scores 100 on competitor AI-readiness tools while every request that names ChatGPT-User is refused on the product pages. If the rule keys on the string, the real agent is refused too. Second pattern: robots.txt blocks GPTBot only, but the WAF rule was written against a substring match on 'GPT' and therefore also blocks nothing visible in robots.txt while silently 429ing OAI-SearchBot.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Implementation deviations

- Probes go through the shared `sharedUaProbes` cache in
  `packages/core/src/gatherers/ua-parity.ts`. Each (URL, User-Agent) pair is
  fetched at most once per scan.
- The sampled product pages are the first two scanned pages. The audit does
  not filter them by page type.
- OAI-SearchBot and ChatGPT-User are probed. GPTBot is read from robots.txt
  only. OAI-AdsBot is out of scope: ad landing-page validation is not on the
  organic commerce path.
- The GPTBot training opt-out is reported, never scored.
- The OpenAI CIDR files are named in the message and the fix, never fetched.
  The scanner is not the agent whose address matters.
- One reason per probe, in fixed order: challenge-body marker, blocking
  status, status-class mismatch, text ratio under 0.6. A target yields at most
  one finding per agent.
- OAI-SearchBot is sent as `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36; compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot`, the example OpenAI gives (https://developers.openai.com/api/docs/bots, verified 2026-10-19). Before 2026-10-19 the probe sent a bare `OAI-SearchBot/1.0` string that OpenAI does not document. GPTBot and ChatGPT-User match the same page.
- The browser baseline is a Mac Chrome UA on the current Stable major, 155 (https://chromiumdash.appspot.com/fetch_releases?channel=Stable&platform=Mac&num=1, verified 2026-10-19). It was Chrome 140 before 2026-10-19.
- Since 2026-10-19 the probe strings are read from the bot registry (`packages/core/src/bot-registry.ts`) rather than kept in the gatherer. The strings this audit sends are unchanged.
- Since 2026-10-19 messages, titles and `details` strings say how the site answers a request whose User-Agent names a bot, never that the bot itself is blocked or sees a page. The verdicts did not change.

## Deferred

- Per-host throttling with `Retry-After`. It needs a shared request scheduler.
  A sleep inside one audit would serialise the whole scan.
- OAI-AdsBot probing, for sites that run paid placements into ChatGPT.
- Diffing the published CIDR ranges against observed edge behaviour. That
  needs the scan to run from a known address.
- **An opaque block on a spoofed User-Agent still fails.** A 403, 429 or 503, or a
  challenge marker in the body, fails at Critical priority. Each is ambiguous for
  a probe that arrives without OpenAI's addresses (Limits). The mechanism above
  names these answers as the failure and nothing here grades a warning, so
  moving them needs the dossier revised first. Not changed in the 2026-10-19
  wording patch.
