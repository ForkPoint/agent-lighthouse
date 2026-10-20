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
  - bing-robots-meta-tags
  - bing-crawlers
  - google-common-crawlers
  - apple-applebot-docs
  - openai-bots
  - anthropic-crawler-docs
  - commoncrawl-ccbot
---

# robots-directives (`2.25`, `1.13`, `4.20`)

> access-crawl-control · source `robots-directives.ts` · rewritten, absorbs no-noindex (1.13) + meta-robots (4.20) · evidence grade **A** · tier **scored** (weight 1.0)

## What it checks

Every robots directive that applies to a scanned page, from both transports and from every directive-carrying meta name:

- `<meta name="robots">` **and** the per-bot names an operator documents reading: `googlebot` and `googlebot-news` (Google), `bingbot` (Bing) and `applebot` (Apple). Tags are read off the DOM, so _all_ tags count rather than the last one;
- the `X-Robots-Tag` response header, including the per-bot `X-Robots-Tag: googlebot: noindex` form, scoped to the same names.

Blocking or snippet-suppressing directives addressed to a name no operator documents reading (`gptbot`, `oai-searchbot`, `chatgpt-user`, `claudebot`, `claude-searchbot`, `claude-user`, `perplexitybot`, `ccbot`, `google-extended`, `applebot-extended`, `msnbot`) are named in the message and never scored. A bot prefix in the header scopes every directive after it.

Values are tokenized on commas and compared token-wise, so `none` is recognised as noindex+nofollow and `noindexifembedded` is not mistaken for a full block.

| State                                                                                     | Result                                                                |
| :---------------------------------------------------------------------------------------- | :-------------------------------------------------------------------- |
| a **non-utility** page carries `noindex`/`none`                                           | `fail` — `critical` when the homepage is among them, otherwise `high` |
| a non-utility page carries `nosnippet`, `max-snippet:0`, or `noarchive` without `nocache` | `warn`, priority `medium` — indexed but unquotable                    |
| a non-utility page carries `nocache` (alone or with `noarchive`)                          | `pass`, naming it — Bing still shows URL, title and snippet           |
| only utility routes (cart, login, search, account, …) carry `noindex`                     | `pass`, naming them                                                   |
| a directive sits only under an undocumented per-bot name (e.g. `gptbot`)                  | verdict unaffected; the message names the tag                         |
| no directive blocks or suppresses                                                         | `pass`                                                                |
| no pages scanned                                                                          | `na`                                                                  |

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** A page carrying `noindex` in a robots meta tag, or in the equivalent `X-Robots-Tag` header, is excluded from Google's Search index. Google documents that the same family of robots directives governs whether the page can be shown, or used as a direct input, in AI Overviews and AI Mode.

**Grade: A** — the consumer is named in vendor documentation. Google Search Central states that `noindex` removes the page from search results. It states that `nosnippet` and `max-snippet` "will also prevent" or "limit" the content being "used as a direct input for AI Overviews and AI Mode".

**Evidence:**

- Google Search Central, robots meta tag reference. `noindex`: "Do not show this page, media, or resource in search results." `nosnippet`: it "will also prevent the content from being used as a direct input for AI Overviews and AI Mode". `max-snippet:[number]`: it "will also limit how much of the content may be used as a direct input for AI Overviews and AI Mode". The doc scopes these rules to "all forms of search results (at Google: web search, Google Images, Discover, AI Overviews, AI Mode)" — https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag (verified 2026-08-21)
- Google Search Central, AI features and your website: site owners may use the `nosnippet`, `data-nosnippet`, `max-snippet` or `noindex` controls to limit how their content appears in AI features on Search. Eligibility for AI Overviews and AI Mode carries "no additional technical requirements" beyond ordinary Search eligibility — that is, the AI surfaces are fed by the same Search index that `noindex` removes the page from — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21)
- The directive is a long-standing, cross-vendor indexing control rather than a Google-only convention; RFC 9309 governs the robots.txt half of the same exclusion family and is a ratified standard with named crawler consumers — https://www.rfc-editor.org/rfc/rfc9309.html (verified 2026-08-21)

**Counter-evidence:** `noindex` gates _index-derived_ surfaces only. User-initiated fetchers are unaffected: OpenAI documents that for `ChatGPT-User` "Because these actions are initiated by a user, robots.txt rules may not apply" (https://developers.openai.com/api/docs/bots), and Perplexity documents that `Perplexity-User` "Generally ignores robots.txt rules" (https://docs.perplexity.ai/guides/bots) — both verified 2026-08-21. A noindexed page can therefore still be fetched and quoted live in a chat answer, so the audit's failure language ("blocking AI crawlers") overstates the effect for the conversational-agent path. The snippet controls are only partly instrumented. The audit reads `nosnippet` and `max-snippet:0` and warns on them, because Google documents that they keep content out of AI Overviews and AI Mode (https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag, verified 2026-10-17). Google ignores `noarchive` and `nocache`; Bing reads both, and its two sources treat them differently. Bing's robots meta tag reference says `noarchive` means "Do not link in Chat and Copilot", and `nocache` means "Display only URL/Snippet/Title in Chat or Copilot". It adds: "If content has both NOCACHE and NOARCHIVE tags, we will treat it as NOCACHE." (https://www.bing.com/webmasters/help/robots-meta-tags-and-attributes-that-bing-supports-5198d240, verified 2026-10-17). The 2023 announcement says the same in other words: "Content tagged NOARCHIVE will not be included in Bing Chat answers, not be linked to in the answers", while "Content with the NOCACHE tag may be included in Bing Chat answers. We will only display URL/Snippet/Title in the answer" (https://blogs.bing.com/webmaster/september-2023/Announcing-new-options-for-webmasters-to-control-usage-of-their-content-in-Bing-Chat, verified 2026-10-17). So `noarchive` alone keeps a page out of Copilot answers, and the audit warns on it. `nocache` limits what Copilot shows but still links and quotes the page's snippet, so it does not forbid quoting. The audit names a `nocache` page in its pass message and does not warn. A page carrying both is treated as `nocache`, as Bing does. Until 2026-10-17 the audit warned on `nocache` as if it forbade quoting; no source supported that. It does not read element-level `data-nosnippet`, and it does not judge a positive `max-snippet` limit, which narrows rather than removes what an AI answer may quote.

**Per-bot meta names (verified 2026-10-20).** Only a name the crawler's operator documents reading can change a verdict.

- Google: "Google supports two user agent tokens in the robots meta tag; other values are ignored" — `googlebot` and `googlebot-news`. The page does not mention Google-Extended — https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag (verified 2026-10-20). Google's crawler page calls Google-Extended "a standalone product token" with a robots.txt group, and says it "doesn't have a separate HTTP request user agent string" — https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers (verified 2026-10-20).
- Bing: "you can replace the generic name="robots" with name="bingbot" to limit the meta tag to only apply to Bing" — https://www.bing.com/webmasters/help/robots-meta-tags-and-attributes-that-bing-supports-5198d240 (verified 2026-10-20). Neither that page nor Bing's crawler list names `msnbot` — https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0 (verified 2026-10-20).
- Apple: "Applebot supports robots meta tags in HTML documents", with the example `<meta name="applebot" content="nosnippet">` and `X-Robots-Tag: applebot: nosnippet`. Applebot-Extended is a robots.txt rule only, and "does not crawl webpages" — https://support.apple.com/en-us/119829 (verified 2026-10-20).
- OpenAI, Anthropic, Perplexity and Common Crawl document robots.txt controls and no robots meta tag or `X-Robots-Tag` — https://developers.openai.com/api/docs/bots, https://support.claude.com/en/articles/8896518, https://docs.perplexity.ai/guides/bots, https://commoncrawl.org/ccbot (all verified 2026-10-20).

So `<meta name="GPTBot" content="noindex">` and its kind bind no documented consumer. The audit names them in its message and does not score them. The grade stays A: it rests on the generic `robots` name and the header, which Google, Bing and Apple document.

## Implementation deviations

- Every scanned page is read, from both transports. Per-bot meta names and the per-bot `X-Robots-Tag` form pass the same crawler allowlist, so a bot-scoped directive binds only that bot.
- All robots meta tags are collected off the DOM, not the last-wins `page.meta`.
- Bing's "both tags means NOCACHE" rule is applied per page, over every directive the page carries. A `nocache` in any transport or allowed meta name cancels a `noarchive` from any other. Bing scopes neither tag to a crawler beyond `bingbot`, and Google ignores both, so the union is the closest reading.
- The content/utility split is made on the URL path (`UTILITY_PATH`: `/cart`, `/checkout`, `/login`, `/account`, `/search`, …). `PageType` cannot carry it: all its values are primary content. A noindexed utility route is named in the pass message.
- The failure copy does not say "blocking AI crawlers". `noindex` gates index-derived surfaces. User-initiated fetchers may still fetch and quote the page live.
- `defaultPriority` is `high`. `critical` is emitted per result, only when the homepage is among the blocked pages.
- `requires` omits `rendered-body` and `sample-adequate`. Meta tags and the `X-Robots-Tag` header arrive whether or not the body renders.
- The audit cannot see whether robots.txt blocks the page. Google says `noindex` only works on a page robots.txt does not block.
- Since 2026-10-19 the per-bot meta names are bot registry tokens (`packages/core/src/bot-registry.ts`), plus `googlebot-news` and `msnbot`, which have no registry row. `anthropic-ai` was dropped. Anthropic's crawler page names ClaudeBot, Claude-User and Claude-SearchBot and no other token (https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler, verified 2026-10-19). A `noindex` addressed only to `anthropic-ai` is ignored. A test pins it.
- A bot prefix in `X-Robots-Tag` scopes every directive after it until the next prefix, as in Google's example `otherbot: noindex, nofollow`. Repeated field lines arrive combined with ", " (RFC 9110 §5.3), so an unprefixed directive from a later line is attributed to the last named bot. Until 2026-10-20 only the first directive after a prefix was scoped, so `gptbot: noindex, nosnippet` warned on the `nosnippet`.
- Google allows a header prefix for any of its crawlers, but only `googlebot` and `googlebot-news` are read. A prefix such as `googlebot-image:` is ignored, which can miss a finding but never invents one. Bing documents the header form of its tags but no `bingbot:` prefix as such; the prefix is read as the header form of the documented `bingbot` meta name.
- A header prefix must start with a letter, so the time half of a comma-split `unavailable_after` date (`25 Jun 2010, 15:00:00 PST`) is not read as a bot, and the directive after it keeps its scope.
- The name lists live in `packages/core/src/robots-meta-names.ts`, shared with `answer-readiness/snippet-gate-coverage`.
- Since 2026-10-20 only `robots`, `googlebot`, `googlebot-news`, `bingbot` and `applebot` are scored. The AI crawler names, `google-extended`, `applebot-extended` and `msnbot` are still read, so the message can name a blocking or snippet-suppressing tag that binds no documented consumer. The note appears on pass, warn and fail alike. Until 2026-10-20 a `noindex` under `gptbot` failed the page, and a `nosnippet` under it warned. No source supported either.
