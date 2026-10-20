---
audit: access-crawl-control/ai-crawler-edge-parity
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/ai-crawler-edge-parity.ts
slug: ai-crawler-edge-parity
evidence_grade: A
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-22"
reviewed: 2026-10-20
graduated: 2026-08-22
sources:
  - duckduckgo-duckassistbot
  - meta-crawlers
  - amazonbot-docs
  - mistral-robots-docs
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
  - google-verify-requests
  - cloudflare-fake-bot-rules
  - cloudflare-block-ai-bots
  - cloudflare-challenge-bad-bots
  - cloudflare-super-bot-fight-mode
  - cloudflare-field-cf-client-bot
  - anubis-bot-policies
  - cloudflare-pay-per-crawl-verify
---

# AI crawler edge-response parity

> Shipped in v2. Evidence grade **A** · scored tier · partial overlap · implementation: `multi-page`

## What it checks

Detects the single most common and most invisible AI-visibility failure: robots.txt grants an AI crawler access, but the CDN/WAF in front of the origin answers that crawler with a challenge, a 403, a 402, or a proof-of-work interstitial. The site owner reads their own robots.txt and believes they are open; the edge refuses every request that names the crawler.

The probe comes from the scanner's address, so it is never the verified crawler. A pay-per-crawl price and a reduced page fail. A challenge, a proof-of-work wall, a 403, a 429 or any other non-2xx where a browser got 200 warns: an edge can refuse an unverified request naming the crawler and still admit the real one.

## Claimed mechanism (falsifiable)

robots.txt (RFC 9309) is advisory metadata parsed by the crawler; the edge access decision is enforced independently by the WAF. Therefore a site can simultaneously publish `User-agent: PerplexityBot / Allow: /` and return a non-200 to every request carrying that user-agent. Falsifiable: fetch URL U with a browser UA and with crawler UA C; if robots.txt permits C for U and the C-request status is not 2xx while the browser-request is 200, the two policy layers contradict each other. Cloudflare makes one branch deterministically classifiable: a challenge response always carries `cf-mitigated: challenge` and `content-type: text/html` (s14). The header says that the answer is a challenge. It does not say whom the rule targets. An edge can challenge unverified automated traffic and allow verified bots (see Limits), so a challenge to the scanner's request does not decide what the verified crawler gets.

## Evidence

- **[Detect a Challenge Page response (cf-mitigated)](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/challenge-pages/detect-response/)** — Cloudflare (vendor-doc, URL verified 2026-08-20)
  - Exact header is `cf-mitigated`; "challenge is the only valid value"; "The header is set for all Challenge Page types." Also: "regardless of the requested resource-type, the content-type of a challenge will be text/html". Gives a deterministic, vendor-documented way for an auditor to distinguish "you were challenged" from "you were served content" or "you hit an ordinary 403".
- **[OpenAI crawlers and user agents](https://developers.openai.com/api/docs/bots)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Exact UA strings and published IP-range JSONs (re-verified 2026-10-19). OAI-SearchBot (`Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) … Chrome/131.0.0.0 Safari/537.36; compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot`) → https://openai.com/searchbot.json. GPTBot (…compatible; GPTBot/1.4; +https://openai.com/gptbot) → https://openai.com/gptbot.json. ChatGPT-User (…compatible; ChatGPT-User/1.0; +https://openai.com/bot) → https://openai.com/chatgpt-user.json. OAI-AdsBot → https://openai.com/adsbot.json. All four JSON endpoints return HTTP 200 (curl-verified). No mention of Web Bot Auth. Note Google-Extended has no UA at all, so it cannot be probed by request.
- **[Verified bots policy — Cloudflare](https://developers.cloudflare.com/bots/concepts/bot/verified-bots/policy/)** — Cloudflare (vendor-doc, URL verified 2026-08-20)
  - Two requirements for verified status: (1) "Honest self-identification — it declares who it is deterministically, through a cryptographic Web Bot Auth signature, a published IP list with a stable user-agent, or reverse DNS." (2) "Non-abusive behavior — it obeys robots.txt and crawl directives...". The page does not say this in words; the reading is that a UA string alone meets none of the three declarations, which is the source of the false-positive ambiguity when auditing edge blocks by UA spoofing.
- **[Anubis (proof-of-work interstitial)](https://anubis.techaro.lol/docs/design/why-proof-of-work/)** — Techaro (vendor-doc, URL verified 2026-08-20)
  - The URL resolves, but served an Anubis deny page rather than the doc. That page itself confirmed the fingerprints an auditor needs: asset paths under `/.within.website/x/cmd/anubis/`, body text "Access Denied: error code <hex>", the footer "Protected by Anubis From Techaro", and a version banner (v1.27.1-…). Treat as a fingerprint source, not as a cited spec; re-verify the doc URL before shipping it in remediation copy.
- **[Challenge bad bots — Cloudflare WAF custom rules](https://developers.cloudflare.com/waf/custom-rules/use-cases/challenge-bad-bots/)** — Cloudflare (vendor-doc, verified 2026-10-20)
  - Example rules: `(cf.bot_management.verified_bot)` with action Skip, "Known good bots (Googlebot, Bingbot, monitoring services) bypass all custom rules", then `(cf.bot_management.score lt 30 and not cf.bot_management.verified_bot)` with action Block. One zone refuses unverified automated traffic and admits verified bots.
- **[Super Bot Fight Mode — Cloudflare](https://developers.cloudflare.com/bots/get-started/super-bot-fight-mode/)** — Cloudflare (vendor-doc, verified 2026-10-20)
  - The settings list "Definitely automated traffic", "Likely automated traffic" and "Verified bots" as separate groupings, each with its own response. A zone can therefore challenge automated traffic and allow verified bots.
- **[cf.client.bot field — Cloudflare](https://developers.cloudflare.com/ruleset-engine/rules-language/fields/reference/cf.client.bot/)** — Cloudflare (vendor-doc, verified 2026-10-20)
  - "Indicates whether the request originated from a known good bot or crawler." It is the field a rule reads to tell a known good bot from a request that only names one. Cloudflare's "Challenge bad bots" examples show such rules in use.
- **[Anubis policy definitions](https://github.com/TecharoHQ/anubis/blob/main/docs/docs/admin/policies.mdx)** — Techaro (vendor-doc, verified 2026-10-20)
  - "you can allow a search engine to connect if and only if its IP address matches the ones they published", with `user_agent_regex` and `remote_addresses` on one rule. An Anubis wall on the scanner's request can sit beside an allow rule for the real crawler's addresses.
- **[Pay per crawl: Verify your AI crawler](https://developers.cloudflare.com/ai-crawl-control/features/pay-per-crawl/use-pay-per-crawl-as-ai-owner/verify-ai-crawler/)** — Cloudflare (vendor-doc, verified 2026-10-20)
  - "When an AI crawler tries to access content protected by pay per crawl, it receives a HTTP status code 402." The response header "includes the cost of the content", for example `crawler-price: USD 0.01`. "To access this content, you must verify your AI crawler." The page does not say what an unverified crawler receives. The 402 and its price are what the scanner's unverified request received, and the page says access requires verification. The price is the site's own statement of terms, so a priced 402 fails.
- **[AI Crawl Control — Cloudflare](https://developers.cloudflare.com/ai-crawl-control/)** — Cloudflare (vendor-doc, URL verified 2026-08-20)
  - "Works automatically on all Cloudflare plans"; operators "Set allow or block rules for individual crawlers" and monitor AI access. Default-block posture and blocked-crawler response codes are not documented on this page — so an auditor must not assert Cloudflare's default behaviour, only measure the observed response.

### Signal: WAF / bot-management blocking AI agents (Cloudflare AI Crawl Control, default blocks, pay-per-crawl 402) — grade A (technical-infra)

This signal moved here from `https-enabled` on 2026-10-18.

**Mechanism:** Edge bot-management sitting in front of the origin can deny AI crawlers and agents outright, or gate them behind payment, so a site with perfect content structure can still be entirely invisible to AI systems. Falsifiable form: fetch the same URL with an AI-crawler User-Agent versus a browser User-Agent; divergent status codes (403 / 401 / 402 / challenge page for the former) prove an access gate independent of content quality.

**Grade: A** — Cloudflare documents the behaviour at scale and by date. It began blocking AI crawlers by default for new domains on 1 July 2025. It has announced that from 15 September 2026, new domains on ad-displaying plans will block Training and Agent class bots by default. That is a named intermediary documenting exactly what it does to the traffic this audit is about, which is grade A. Two caveats shape how it can be measured, rather than whether it is true. User-agent probing is unreliable in both directions: Perplexity was documented using a Chrome-impersonating stealth crawler, and scrapers routinely spoof GPTBot. An opaque block therefore cannot be told apart from correct impersonation defence. Since 2026-10-20 the same reading covers a challenge, a proof-of-work wall and any other refusal of the probe: each is a documented way to treat unverified traffic, so each warns. The grade stands on the documented gate. What fails is what the site states in its answer: a pay-per-crawl price, or a page with most of the text missing.

**Evidence:** Fully documented vendor behaviour at large scale. Cloudflare began blocking AI crawlers by default for new domains on 1 July 2025, making permission the default posture across a very large share of the web. It has since announced that from 15 September 2026 new domains will block 'Training' and 'Agent' class bots by default on ad-displaying pages while leaving 'Search' allowed, and has extended managed robots.txt with a `use` signal (immediate / reference / full). Pay-per-crawl operationalises the gate in HTTP. Crawlers 'either present payment intent via request headers for successful HTTP 200 access, or receive an HTTP 402 Payment Required response with pricing', at a minimum of $0.001 per crawl. Critically, an existing WAF or Bot Management block rule overrides pay-per-crawl's charge behaviour, and silently converts a monetizable crawl into a hard block. Adoption context: of 3,816 top-10k domains with robots.txt, ~14% carried AI-bot directives; GPTBot was the most-disallowed at 312 domains. Verification is moving to cryptography — Cloudflare's Web Bot Auth implements RFC 9421 HTTP Message Signatures with Signature-Input / Signature / Signature-Agent headers and a JWKS key directory at /.well-known/http-message-signatures-directory.

**Counter-evidence:** Two caveats that shape how this must be audited. (1) User-Agent-based probing is unreliable in both directions: Cloudflare documented Perplexity using a Chrome-impersonating stealth crawler on unlisted IPs across rotating ASNs at 3–6M requests/day to evade no-crawl directives, and conversely malicious scrapers routinely spoof GPTBot. An audit that merely sets a UA header measures the WAF's UA rules, not real agent access — genuine verification requires the vendors' published IP ranges (openai.com/gptbot.json, claude.com/crawling/bots.json, perplexity.com/perplexitybot.json) or Web Bot Auth signatures. (2) Blocking is often a deliberate, rational business decision, not a defect. Cloudflare's crawl-to-refer data puts Anthropic at about 71,000 crawls per HTML referral in the June 2025 window, with the caveat that Claude's native app sends no Referer. That makes uncompensated crawl a real cost. The audit should report the gate neutrally, as 'the edge answers requests that name this agent differently', rather than scoring it as a failure, since the site owner may have chosen it.

## Limits

- Every probe leaves the scanner's own address with an AI crawler's name in the User-Agent. It shows how the site answers a request that names the AI crawler. It does not show what the real crawler receives.
- Real bots are told apart by network or signature, not by the string. Cloudflare grants verified status to a bot that "declares who it is deterministically, through a cryptographic Web Bot Auth signature, a published IP list with a stable user-agent, or reverse DNS" ([Cloudflare verified bots policy](https://developers.cloudflare.com/bots/concepts/bot/verified-bots/policy/) (verified 2026-10-19)). OpenAI publishes one IP-range file per bot, for example https://openai.com/gptbot.json and https://openai.com/chatgpt-user.json ([OpenAI crawlers and user agents](https://developers.openai.com/api/docs/bots) (verified 2026-10-19)). Google, whose crawlers this audit does not probe, illustrates the same rule: it documents a reverse-DNS check, or a match against its published IP ranges ([Verifying Google crawlers and fetchers](https://developers.google.com/crawling/docs/crawlers-fetchers/verify-google-requests) (verified 2026-10-19)). The scanner can present none of these.
- A CDN block of a request naming an AI crawler is ambiguous evidence. Without a signature, a published IP list or reverse DNS, the request is by definition not the verified bot ([Cloudflare verified bots policy](https://developers.cloudflare.com/bots/concepts/bot/verified-bots/policy/) (verified 2026-10-19)), so an edge may treat it as unknown automated traffic. Cloudflare does ship managed rules that flag an unverified request naming Googlebot or Bingbot as a fake bot ([Cloudflare fake bot managed rules](https://developers.cloudflare.com/waf/troubleshooting/fake-bot-managed-rules/) (verified 2026-10-19)). It documents no such rule for AI crawlers, and the scanner never sends either of those names. The analogy shows the mechanism exists. It is not evidence about the bots probed here. A refusal is consistent with the real bot being refused too. It does not prove it. GPTBot, which this audit probes, is a training crawler. Cloudflare's legacy Block AI bots setting, labelled "Deprecating on September 15, 2026", "blocks verified bots that are classified as crawling for the purpose of AI training" "plus additional unverified bots that fall under these classifications", and "excludes mixed-purpose bots" ([Cloudflare Block AI bots](https://developers.cloudflare.com/bots/additional-configurations/block-ai-bots/) (verified 2026-10-19)).
- An edge can answer the two differently by design. Cloudflare's own example rules do exactly this: `(cf.bot_management.verified_bot)` skips all remaining custom rules, so "Known good bots ... bypass all custom rules", and `(cf.bot_management.score lt 30 and not cf.bot_management.verified_bot)` blocks other automated traffic ([Cloudflare Challenge bad bots](https://developers.cloudflare.com/waf/custom-rules/use-cases/challenge-bad-bots/) (verified 2026-10-20)). Super Bot Fight Mode likewise gives "Definitely automated traffic", "Likely automated traffic" and "Verified bots" separate responses ([Cloudflare Super Bot Fight Mode](https://developers.cloudflare.com/bots/get-started/super-bot-fight-mode/) (verified 2026-10-20)). Its rules can read `cf.client.bot`, which "Indicates whether the request originated from a known good bot or crawler" ([Cloudflare cf.client.bot](https://developers.cloudflare.com/ruleset-engine/rules-language/fields/reference/cf.client.bot/) (verified 2026-10-20)). Anubis can "allow a search engine to connect if and only if its IP address matches the ones they published" ([Anubis policy definitions](https://github.com/TecharoHQ/anubis/blob/main/docs/docs/admin/policies.mdx) (verified 2026-10-20)). This audit's own fix recommends the verified-bot route, so a site that follows it can still refuse the probe.
- A pass does not prove access either. A rule keyed on the verified bot's identity rather than its string can refuse the real bot and still let the probe through.
- For these reasons every refusal of the probe warns: a Cloudflare challenge, a proof-of-work wall, a 200 challenge page, a 403, a 429, a transport error, and any other non-2xx where a browser got 200. Two answers still fail, because they say something about the site rather than about the probe. A pay-per-crawl 402 carries the site's price. Cloudflare says a crawler on content protected by pay per crawl "receives a HTTP status code 402" with the cost in a header, and that "To access this content, you must verify your AI crawler" ([Cloudflare pay per crawl: Verify your AI crawler](https://developers.cloudflare.com/ai-crawl-control/features/pay-per-crawl/use-pay-per-crawl-as-ai-owner/verify-ai-crawler/) (verified 2026-10-20)). A soft block is a 200 with under 40% of the browser text and no challenge in it, which is a different page body. A challenge marker counts only when the browser response does not carry it too: Akamai and Imperva inject their script paths into ordinary pages.

## Example failure

robots.txt contains `User-agent: PerplexityBot` / `Allow: /`. `GET /pricing` with a Chrome UA returns 200 and 4,100 chars of main text; the identical request with `PerplexityBot` returns 403 with `cf-mitigated: challenge` and `content-type: text/html`. The site answers a request that names PerplexityBot with a challenge, and nothing in its own configuration reveals this. The audit warns: whether the real PerplexityBot, arriving from its published addresses, gets the same answer depends on whether the rule keys on the string or on verified identity. The same URL answered with a 200 carrying 300 of the 4,100 characters fails, because that is a different page.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

Only a crawler robots.txt admits is judged. A pay-per-crawl 402 with a price, or a soft block with no challenge in it, fails at Critical. Any other refusal of the probe warns at Medium. Everything else passes.

## Implementation deviations

- The probe set is `/`, up to 2 sitemap URLs and `/llms.txt`. The sketch said 2-3 content URLs.
- Sitemap URLs come from the shared sitemap gatherer. On a subpath homepage it keeps only same-origin URLs under that directory.
- Every probe is memoised per scan (`sharedUaProbes`). The UA-parity audits share one baseline and one probe per (URL, crawler) pair.
- `Google-Extended` is not probed. It is a robots.txt token with no user agent of its own.
- Findings are grouped by URL and cause, not listed per crawler.
- Before 2026-10-20 a generic non-2xx where a browser gets 200 was a hard finding, quoting both statuses. That contradicted the grade-A signal's own reading, that an opaque block cannot be told apart from impersonation defence. Since 2026-10-20 it warns, quoting both statuses.
- Before 2026-10-20 a Cloudflare challenge and a proof-of-work wall failed. Since then they warn. One shared classifier, `probeChallenge` in `packages/core/src/gatherers/ua-parity.ts`, decides what a challenge is for this audit, `agentic-commerce/agent-ua-commerce-parity` and `bot-content-delta-declared`: a `cf-mitigated` challenge, an Anubis page (HTTP 200 by default), or a challenge marker in the probe body that the browser body does not carry. A soft block with such a marker is reported as a challenge page and warns too. A pay-per-crawl 402 and a soft block with no marker still fail.
- A URL where the browser itself got a non-2xx is not compared. It is named in `found`. Before 2026-10-19 a stale URL that answered 404 to everyone failed as "HTTP 404 where a browser got 404", which the mechanism above rules out: it needs the browser request to be 200.
- An opaque 403 or 429 is a warning, never a failure. The scanner sends the crawler User-Agent without the matching source IP, so it cannot tell a block from impersonation defence. Since 2026-10-20 the warning text names challenges and other refusals as well.
- OAI-SearchBot is sent as `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36; compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot`, the example OpenAI gives (https://developers.openai.com/api/docs/bots, verified 2026-10-19). Before 2026-10-19 the probe sent a bare `OAI-SearchBot/1.0` string that OpenAI does not document. GPTBot and ChatGPT-User match the same page.
- PerplexityBot is sent as the full string Perplexity documents (https://docs.perplexity.ai/docs/resources/perplexity-crawlers, verified 2026-10-19).
- The ClaudeBot and Claude-User strings are observed, not vendor-documented. Anthropic's crawler page names both tokens but publishes no User-Agent string (https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler, verified 2026-10-19). A finding for either reports how the site answers a request that carries that observed string.
- Since 2026-10-19 the probe set is read from the bot registry (`packages/core/src/bot-registry.ts`): every documented row with a literal User-Agent string. That added two user-triggered fetchers. Perplexity-User is sent as `Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)`; Perplexity says it "supports user actions within Perplexity" (https://docs.perplexity.ai/docs/resources/perplexity-crawlers, verified 2026-10-19). MistralAI-User is sent as `Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; MistralAI-User/1.0; +https://docs.mistral.ai/robots)`, which Mistral labels the full user-agent string of the fetcher that answers a user's question in Vibe (https://docs.mistral.ai/robots, verified 2026-10-19). Both strings are copied verbatim. A block of either now counts the same way a ChatGPT-User block already did. Each costs one request per probed URL.
- The other documented user-triggered fetchers are not probed, because no literal string exists. Amazon's Amzn-User string carries a `Chrome/W.X.Y.Z` placeholder (https://developer.amazon.com/amazonbot, verified 2026-10-19). Meta says its log entries "will be similar to" `meta-externalfetcher/1.1 (+/documentation/sharing/webmasters/web-crawlers)` (https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/, verified 2026-10-19). Filling in either would invent a string. DuckAssistBot is not probed: DuckDuckGo does not say its fetches are user-triggered.
- The browser baseline is a Mac Chrome UA on the current Stable major, 155 (https://chromiumdash.appspot.com/fetch_releases?channel=Stable&platform=Mac&num=1, verified 2026-10-19). It was Chrome 140 before 2026-10-19.
- Since 2026-10-19 messages, titles and `details` strings say how the site answers a request whose User-Agent names a bot, never that the bot itself is blocked or sees a page. The verdicts did not change.

## Deferred

- **No reverse-DNS or published-CIDR verification.** Fetching from a verified
  crawler address would resolve the 403/429 ambiguity, and needs infrastructure
  the scanner does not have.
- **No retry on a rate limit.** A 429 is reported as observed. Honouring
  `Retry-After` inside a single audit would stall the scan.
- **The soft-block threshold is fixed at 40% of the baseline main-content
  text.** A page that legitimately serves less to a crawler reads as a soft
  block.
- **A soft block keyed on verified identity still fails.** A 200 under 40% of
  the browser text with no challenge marker is read as a different page. An edge
  that serves unverified look-alikes a stub, and the verified crawler the page,
  reads the same. The control arm `bot-content-delta-declared` uses would
  separate bot management from a page keyed on the name, at one request per URL.

## Review history

- **2026-10-20:** a Cloudflare challenge, a proof-of-work wall, a 200 challenge
  page and a generic non-2xx where a browser got 200 moved from fail to warn.
  The grade-A signal already said an opaque block cannot be told apart from
  impersonation defence. Super Bot Fight Mode, `cf.client.bot` and Anubis
  policies show the same holds for a challenge. Grade, tier and weight are
  unchanged.

- **2026-10-18:** the WAF / bot-management signal (grade A) and its Cloudflare
  sources moved here from `access-crawl-control/https-enabled`. This audit is
  the one that measures the edge answer per crawler user agent. The grade
  here was already A; it does not change.
