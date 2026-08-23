---
audit: access-crawl-control/bot-content-delta-declared
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/bot-content-delta-declared.ts
slug: bot-content-delta-declared
evidence_grade: A
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-22"
reviewed: 2026-08-20
graduated: 2026-08-22
---


# Bot-specific content delta declared, not cloaked

> Shipped in v2. Evidence grade **A** · scored tier · unique · implementation: `multi-page`

## What it checks

Measures whether the site serves materially different content to AI crawler user-agents than to a browser, and — when it does — whether that difference is declared with the structured data Google specifies for restricted content. Undeclared UA-conditional serving is cloaking, and it also means answer engines cite your paywall stub instead of your article.

## Claimed mechanism (falsifiable)

Google states that `isAccessibleForFree: false` with `hasPart`/`cssSelector` markup 'helps Google differentiate paywalled content from the practice of cloaking, which violates spam policies' (s15) — that is, serving a crawler less than a user is sanctioned *only* when declared. Falsifiable and directly measurable: extract main text for URL U under a browser UA and under crawler UA C; if len(text_C)/len(text_browser) falls below threshold (or shingle Jaccard drops below ~0.7), the site conditions content on UA. The declaration is equally checkable — and, importantly, the declared `cssSelector` must match a real element in the served HTML, which is where most implementations silently fail.

## Evidence

- **[Paywalled content structured data](https://developers.google.com/search/docs/appearance/structured-data/paywalled-content)** — Google (vendor-doc, URL verified 2026-08-20)
  - `isAccessibleForFree: false` plus `hasPart` with `@type: WebPageElement`, `isAccessibleForFree: false` and a `cssSelector` naming the restricted region. Applies to CreativeWork subtypes (Article, NewsArticle, Blog, Course, HowTo, Review, WebPage, Comment, Message). Google states this markup "helps Google differentiate paywalled content from the practice of cloaking, which violates spam policies" — i.e. serving less content to a crawler is only safe when declared.
- **[OpenAI crawlers and user agents](https://developers.openai.com/api/docs/bots)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Exact UA strings and published IP-range JSONs. OAI-SearchBot (…compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot) → https://openai.com/searchbot.json. GPTBot (…compatible; GPTBot/1.4; +https://openai.com/gptbot) → https://openai.com/gptbot.json. ChatGPT-User (…compatible; ChatGPT-User/1.0; +https://openai.com/bot) → https://openai.com/chatgpt-user.json. OAI-AdsBot → https://openai.com/adsbot.json. All four JSON endpoints return HTTP 200 (curl-verified). No mention of Web Bot Auth. Note Google-Extended has no UA at all, so it cannot be probed by request.

## Competitor coverage

None found in the 2026-08 competitor survey.

## Implementation sketch

Multi-page, no JS required. 1) Sample 3-5 content URLs (sitemap or internal links), preferring article/product pages. 2) For each, fetch with baseline Chrome UA and with GPTBot/1.4, ClaudeBot and PerplexityBot, identical headers otherwise. 3) Extract main text with the existing parser; normalise whitespace and strip nav/footer. 4) Compute (a) character-count ratio bot/browser and (b) 5-gram shingle Jaccard similarity. Flag a delta when ratio < 0.6 or Jaccard < 0.7 — two metrics because a stub and a reordered-but-equivalent page look identical on length alone. 5) When a delta is found, parse JSON-LD from the browser response and require: a CreativeWork subtype (Article, NewsArticle, Blog, WebPage, Course, HowTo, Review, Comment, Message) with `isAccessibleForFree: false`, plus a `hasPart` of `@type: WebPageElement` with `isAccessibleForFree: false` and a `cssSelector`. 6) Then verify the selector actually resolves — run it against the served DOM with cheerio; a selector matching zero elements is a silent no-op and should be its own finding. 7) Verdict: pass when there is no delta, or a delta with complete and resolving markup. Fail on delta without markup. Separately flag the inverse case (bot text materially LONGER than browser text), which indicates a bot-only keyword-stuffed variant.

## Example failure

An article renders 6,200 chars of body text to Chrome. The same URL fetched as `GPTBot/1.4` returns 200 with 480 chars — headline, dek, and a subscribe prompt — and the page's JSON-LD NewsArticle omits `isAccessibleForFree` entirely. The site reads as cloaking to Google's spam policy, and ChatGPT/Perplexity ingest and cite the 480-char stub as if it were the article.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

- **Three crawler UAs, three sampled URLs.** The sketch says 3-5 URLs; three
  keeps the probe count at nine per scan, and every probe is shared with the
  other UA-parity audits through `sharedUaProbes`, so overlapping URLs cost one
  request between them.
- **URLs come from the sitemap sample.** The sketch allows internal links as a
  fallback; the sitemap sample is deterministic (`sampleEntries`, even stride),
  so a re-scan compares the same pages.
- **A `soft-block` probe is compared, not discarded.** The shared gatherer gives
  that class to a 200 carrying under 40% of the baseline text — which is exactly
  the delta this audit adjudicates. Every other block class means the crawler
  never got a page at all, and that is
  `access-crawl-control/ai-crawler-edge-parity`'s finding, not this one's.
- **`isAccessibleForFree` is read as both a boolean and the strings
  "false"/"False"**, which is how CMS templates emit it.
- **The `cssSelector` is resolved with cheerio against the exact body the
  browser baseline received**, not against the crawler response — the
  declaration describes what a reader sees and the crawler does not.
- **An unparseable selector counts as resolving to nothing.** It cannot match an
  element, and reporting a parse error separately would split one defect in two.

## Deferred

- **No JavaScript execution.** A site that injects the restricted body after
  hydration serves an empty selector target in the HTML, and reads here as a
  silent no-op. That is the honest reading of the served DOM, but a headless
  browser would settle it.
- **The thresholds are fixed** at a 0.6 length ratio and 0.7 shingle
  similarity, per the sketch. A page whose boilerplate dominates its main
  content can cross either line without a real delta; both metrics are always
  reported so the reader can see which one fired.
- **Only the first complete declaration is read.** A page carrying several
  CreativeWork nodes with different `hasPart` selectors is judged on the first
  that validates.
- **The inverse case is reported, not diagnosed.** Bot text materially longer
  than the browser text is flagged as a bot-only variant; deciding whether it is
  keyword stuffing or a legitimately expanded print view needs a human.
