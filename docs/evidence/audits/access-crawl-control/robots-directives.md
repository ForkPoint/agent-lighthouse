---
audit: access-crawl-control/robots-directives
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/robots-directives.ts
slug: robots-directives
evidence_grade: A
disposition: "rewritten + merged 2026-08-22 (Plan 4, Task 5) — absorbs no-noindex (1.13) and meta-robots (4.20)"
reviewed: 2026-08-22
sources:
  - google-robots-meta-tag
  - google-ai-features-trust
  - rfc9309
  - s18
  - perplexity-bots-docs
  - bing-chat-controls-2023
---

# robots-directives (`2.25`, `1.13`, `4.20`)

> access-crawl-control · source `robots-directives.ts` · rewritten, absorbs no-noindex (1.13) + meta-robots (4.20) · evidence grade **A** · tier **scored** (weight 1.0)

## What it checks

Every robots directive that applies to a scanned page, from both transports and from every directive-carrying meta name:

- `<meta name="robots">` **and** the per-bot forms (`googlebot`, `google-extended`, `gptbot`, `oai-searchbot`, `claudebot`, `applebot-extended`, `bingbot`, `perplexitybot`, …), read off the DOM so _all_ tags count rather than the last one;
- the `X-Robots-Tag` response header, including the per-bot `X-Robots-Tag: googlebot: noindex` form.

Values are tokenized on commas and compared token-wise, so `none` is recognised as noindex+nofollow and `noindexifembedded` is not mistaken for a full block.

| State                                                                             | Result                                                                |
| :-------------------------------------------------------------------------------- | :-------------------------------------------------------------------- |
| a **non-utility** page carries `noindex`/`none`                                   | `fail` — `critical` when the homepage is among them, otherwise `high` |
| a non-utility page carries `nosnippet`, `max-snippet:0`, `noarchive` or `nocache` | `warn`, priority `medium` — indexed but unquotable                    |
| only utility routes (cart, login, search, account, …) carry `noindex`             | `pass`, naming them                                                   |
| no directive blocks or suppresses                                                 | `pass`                                                                |
| no pages scanned                                                                  | `na`                                                                  |

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** A page carrying `noindex` in a robots meta tag, or in the equivalent `X-Robots-Tag` header, is excluded from Google's Search index. Google documents that the same family of robots directives governs whether the page can be shown, or used as a direct input, in AI Overviews and AI Mode.

**Grade: A** — the consumer is named in vendor documentation. Google Search Central states that `noindex` removes the page from search results. It states that `nosnippet` and `max-snippet` "will also prevent" or "limit" the content being "used as a direct input for AI Overviews and AI Mode".

**Evidence:**

- Google Search Central, robots meta tag reference. `noindex`: "Do not show this page, media, or resource in search results." `nosnippet`: it "will also prevent the content from being used as a direct input for AI Overviews and AI Mode". `max-snippet:[number]`: it "will also limit how much of the content may be used as a direct input for AI Overviews and AI Mode". The doc scopes these rules to "all forms of search results (at Google: web search, Google Images, Discover, AI Overviews, AI Mode)" — https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag (verified 2026-08-21)
- Google Search Central, AI features and your website: site owners may use the `nosnippet`, `data-nosnippet`, `max-snippet` or `noindex` controls to limit how their content appears in AI features on Search. Eligibility for AI Overviews and AI Mode carries "no additional technical requirements" beyond ordinary Search eligibility — that is, the AI surfaces are fed by the same Search index that `noindex` removes the page from — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21)
- The directive is a long-standing, cross-vendor indexing control rather than a Google-only convention; RFC 9309 governs the robots.txt half of the same exclusion family and is a ratified standard with named crawler consumers — https://www.rfc-editor.org/rfc/rfc9309.html (verified 2026-08-21)

**Counter-evidence:** `noindex` gates _index-derived_ surfaces only. User-initiated fetchers are unaffected: OpenAI documents that for `ChatGPT-User` "Because these actions are initiated by a user, robots.txt rules may not apply" (https://developers.openai.com/api/docs/bots), and Perplexity documents that `Perplexity-User` "Generally ignores robots.txt rules" (https://docs.perplexity.ai/guides/bots) — both verified 2026-08-21. A noindexed page can therefore still be fetched and quoted live in a chat answer, so the audit's failure language ("blocking AI crawlers") overstates the effect for the conversational-agent path. The snippet controls are only partly instrumented. The audit reads `nosnippet` and `max-snippet:0` and warns on them, because Google documents that they keep content out of AI Overviews and AI Mode (https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag, verified 2026-10-17). It also warns on `noarchive` and `nocache`. Google ignores both. Bing documents that "Content tagged NOARCHIVE will not be included in Bing Chat answers", and that NOCACHE content may appear with only its URL, title and snippet (https://blogs.bing.com/webmaster/september-2023/Announcing-new-options-for-webmasters-to-control-usage-of-their-content-in-Bing-Chat, verified 2026-10-17). It does not read element-level `data-nosnippet`, and it does not judge a positive `max-snippet` limit, which narrows rather than removes what an AI answer may quote.

## Implementation deviations

- Every scanned page is read, from both transports. Per-bot meta names and the per-bot `X-Robots-Tag` form pass the same crawler allowlist, so a bot-scoped directive binds only that bot.
- All robots meta tags are collected off the DOM, not the last-wins `page.meta`.
- The content/utility split is made on the URL path (`UTILITY_PATH`: `/cart`, `/checkout`, `/login`, `/account`, `/search`, …). `PageType` cannot carry it: all its values are primary content. A noindexed utility route is named in the pass message.
- The failure copy does not say "blocking AI crawlers". `noindex` gates index-derived surfaces. User-initiated fetchers may still fetch and quote the page live.
- `defaultPriority` is `high`. `critical` is emitted per result, only when the homepage is among the blocked pages.
- `requires` omits `rendered-body` and `sample-adequate`. Meta tags and the `X-Robots-Tag` header arrive whether or not the body renders.
- The audit cannot see whether robots.txt blocks the page. Google says `noindex` only works on a page robots.txt does not block.
