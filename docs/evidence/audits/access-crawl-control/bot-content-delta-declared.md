---
audit: access-crawl-control/bot-content-delta-declared
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/bot-content-delta-declared.ts
slug: bot-content-delta-declared
evidence_grade: A
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-22"
reviewed: 2026-10-19
graduated: 2026-08-22
sources:
  - s15
  - s18
  - openai-searchbot-ips
  - anthropic-crawlers
  - perplexity-crawlers-doc
  - chromium-dash-stable
  - s4
  - google-verify-requests
  - cloudflare-block-ai-bots
---

# Bot-specific content delta declared, not cloaked

> Shipped in v2. Evidence grade **A** · scored tier · unique · implementation: `multi-page`

## What it checks

Measures whether the site serves materially different content to AI crawler user-agents than to a browser, and — when it does — whether that difference is declared with the structured data Google specifies for restricted content. Undeclared UA-conditional serving is cloaking, and it also means answer engines cite your paywall stub instead of your article.

## Claimed mechanism (falsifiable)

Google states that `isAccessibleForFree: false` with `hasPart`/`cssSelector` markup 'helps Google differentiate paywalled content from the practice of cloaking, which violates spam policies' (s15) — that is, serving a crawler less than a user is sanctioned _only_ when declared. Falsifiable and directly measurable: extract main text for URL U under a browser UA and under crawler UA C; if len(text_C)/len(text_browser) falls below threshold (or shingle Jaccard drops below ~0.7), the site conditions content on UA. The declaration is equally checkable — and, importantly, the declared `cssSelector` must match a real element in the served HTML, which is where most implementations silently fail.

## Evidence

- **[Paywalled content structured data](https://developers.google.com/search/docs/appearance/structured-data/paywalled-content)** — Google (vendor-doc, URL verified 2026-08-20)
  - `isAccessibleForFree: false` plus `hasPart` with `@type: WebPageElement`, `isAccessibleForFree: false` and a `cssSelector` naming the restricted region. Applies to CreativeWork subtypes (Article, NewsArticle, Blog, Course, HowTo, Review, WebPage, Comment, Message). Google states this markup "helps Google differentiate paywalled content from the practice of cloaking, which violates spam policies" — i.e. serving less content to a crawler is only safe when declared.
- **[OpenAI crawlers and user agents](https://developers.openai.com/api/docs/bots)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Exact UA strings and published IP-range JSONs (re-verified 2026-10-19). OAI-SearchBot (`Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) … Chrome/131.0.0.0 Safari/537.36; compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot`) → https://openai.com/searchbot.json. GPTBot (…compatible; GPTBot/1.4; +https://openai.com/gptbot) → https://openai.com/gptbot.json. ChatGPT-User (…compatible; ChatGPT-User/1.0; +https://openai.com/bot) → https://openai.com/chatgpt-user.json. OAI-AdsBot → https://openai.com/adsbot.json. All four JSON endpoints return HTTP 200 (curl-verified). No mention of Web Bot Auth. Note Google-Extended has no UA at all, so it cannot be probed by request.

## Limits

- Every probe leaves the scanner's own address with an AI crawler's name in the User-Agent. It shows how the site answers a request that names the AI crawler. It does not show what the real crawler receives.
- Real bots are told apart by network or signature, not by the string. Cloudflare grants verified status to a bot that "declares who it is deterministically, through a cryptographic Web Bot Auth signature, a published IP list with a stable user-agent, or reverse DNS" ([Cloudflare verified bots policy](https://developers.cloudflare.com/bots/concepts/bot/verified-bots/policy/) (verified 2026-10-19)). OpenAI publishes one IP-range file per bot, for example https://openai.com/gptbot.json and https://openai.com/chatgpt-user.json ([OpenAI crawlers and user agents](https://developers.openai.com/api/docs/bots) (verified 2026-10-19)). Google, whose crawlers this audit does not probe, illustrates the same rule: it documents a reverse-DNS check, or a match against its published IP ranges ([Verifying Google crawlers and fetchers](https://developers.google.com/crawling/docs/crawlers-fetchers/verify-google-requests) (verified 2026-10-19)). The scanner can present none of these.
- The delta this audit reports is UA-keyed. A site that serves the real crawler by verified identity can give it a different page than the probe gets.
- There is no control User-Agent here. A thinner 200 served to an unverified look-alike reads the same as one served to the crawler by name. For GPTBot, a training crawler, Cloudflare's legacy Block AI bots setting, labelled "Deprecating on September 15, 2026", covers "additional unverified bots" as well as verified training bots ([Cloudflare Block AI bots](https://developers.cloudflare.com/bots/additional-configurations/block-ai-bots/) (verified 2026-10-19)); see Deferred.

## Example failure

An article renders 6,200 chars of body text to Chrome. The same URL fetched as `GPTBot/1.4` returns 200 with 480 chars — headline, dek, and a subscribe prompt — and the page's JSON-LD NewsArticle omits `isAccessibleForFree` entirely. The site reads as cloaking to Google's spam policy, and ChatGPT/Perplexity ingest and cite the 480-char stub as if it were the article.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Implementation deviations

- Three crawler UAs and three sampled URLs. The sketch said 3-5 URLs. Probes are shared with the other UA-parity audits through `sharedUaProbes`.
- URLs come from the sitemap sample only (`sampleEntries`, even stride), so a re-scan compares the same pages. On a subpath homepage the shared sitemap gatherer keeps only same-origin URLs under that directory.
- A `soft-block` probe is compared, not discarded: it is exactly the delta this audit judges. Every other block class is `access-crawl-control/ai-crawler-edge-parity`'s finding.
- `isAccessibleForFree` is read as a boolean and as the strings "false"/"False".
- The `cssSelector` is resolved with cheerio against the body the browser baseline received.
- An unparseable selector counts as resolving to nothing.
- PerplexityBot is sent as the full string Perplexity documents (https://docs.perplexity.ai/docs/resources/perplexity-crawlers, verified 2026-10-19).
- The ClaudeBot string is observed, not vendor-documented. Anthropic's crawler page names the token but publishes no User-Agent string (https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler, verified 2026-10-19). A finding for it reports how the site answers a request that carries that observed string.
- The browser baseline is a Mac Chrome UA on the current Stable major, 155 (https://chromiumdash.appspot.com/fetch_releases?channel=Stable&platform=Mac&num=1, verified 2026-10-19). It was Chrome 140 before 2026-10-19.
- Since 2026-10-19 the probe strings are read from the bot registry (`packages/core/src/bot-registry.ts`) rather than kept in the gatherer. The strings this audit sends are unchanged.
- Since 2026-10-19 messages, titles and `details` strings say how the site answers a request whose User-Agent names a bot, never that the bot itself is blocked or sees a page. The verdicts did not change.

## Deferred

- **No JavaScript execution.** A restricted body injected after hydration reads
  as a selector that resolves to nothing. A headless browser would settle it.
- **The thresholds are fixed** at a 0.6 length ratio and 0.7 shingle
  similarity. Boilerplate-heavy pages can cross either line without a real
  delta. Both metrics are always reported.
- **Only the first complete declaration is read.** A page with several
  CreativeWork nodes is judged on the first that validates.
- **The inverse case is reported, not diagnosed.** Bot text materially longer
  than browser text is flagged. Telling keyword stuffing from an expanded print
  view needs a human.
- **No control arm.** A truncated 200 (`soft-block`) is compared as content. Where
  it is bot management aimed at unverified clients, the audit still fails it as an
  undeclared delta. The control probe that `agent-ua-content-divergence-diff`
  uses would separate the two; adding it costs one request per URL and changes
  verdicts, so it waits for its own change.
