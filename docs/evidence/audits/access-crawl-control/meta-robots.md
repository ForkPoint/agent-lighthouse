---
audit: access-crawl-control/meta-robots
audit_id: "4.20"
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/meta-robots.ts
slug: meta-robots
review_verdict: fix
severity: high
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# meta-robots (`4.20`)

> meta-tags · source `meta-robots.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

The "noindex" directive tells AI crawlers like GPTBot and ClaudeBot to skip this page entirely. Your content will be invisible to AI answer engines and will never appear in AI-generated responses. Remove "noindex" unless you intentionally want to block AI indexing.

## Code review findings (2026-08-20, 11-agent pass)

The most important audit in the category and the one whose false PASSES are most damaging. Its entire logic is `robots.includes('noindex')`, which misses the `none` directive (equivalent to noindex,nofollow), misses `X-Robots-Tag` response headers, misses bot-specific meta tags, and can be flipped by the parser's last-wins duplicate handling. It also reports a green 'not blocking' pass when the scan fetched no pages at all. A user whose site is fully deindexed can be told, at critical priority, that everything is fine.

**Required fix:** 1) Handle `none`: `if (robots.includes('noindex'))` misses `<meta name="robots" content="none">`, which is defined as noindex+nofollow. Parse the value into comma-separated tokens and test membership against `['noindex','none']` rather than substring-matching. 2) Read `X-Robots-Tag` from `page.fetchResult.headers` — header-based noindex is extremely common (CDN rules, staging protection, WAF) and is completely invisible today, producing a green pass on a deindexed site. 3) Check bot-specific names too: `googlebot`, `google-extended`, `gptbot`, `claudebot`, `perplexitybot`, `bingbot` meta tags can carry noindex independently of `robots`; an AI-readiness tool that ignores `<meta name="gptbot" content="noindex">` is missing its own subject matter. 4) Token-match rather than substring-match to avoid flagging `noindexifembedded` (a real, much narrower Google directive) as a full block. 5) Replace the empty-pages `pass` ('No meta robots tag found (not blocking by default)') with `notApplicable()` — reporting a critical-priority PASS when nothing was fetched is the worst possible failure mode. 6) Iterate all `ctx.pages`; a single noindexed interior page is invisible today. 7) Note that `parser.ts extractMetaTags` is last-wins, so duplicate robots tags silently resolve to the last one — surface a warning when more than one `<meta name="robots">` exists.

**False-positive risks:**
- `content="none"` false PASS: `robots.includes('noindex')` is false for `<meta name="robots" content="none">`, which means noindex+nofollow. The audit reports 'meta robots is "none" (no blocking directives)' — a green, critical-priority pass on a page that is fully blocked. This is actively wrong guidance on the highest-stakes check in the tool.
- `X-Robots-Tag: noindex` response header is never read (`page.fetchResult.headers` is available and unused). Sites deindexed at the CDN/server layer pass cleanly.
- Bot-specific meta tags ignored: `<meta name="googlebot" content="noindex">`, `<meta name="google-extended" content="noindex">`, `<meta name="GPTBot" content="noindex">` all pass. For a tool whose stated subject is GPTBot/ClaudeBot access, missing the AI-bot-specific form is a direct miss.
- Substring false FAIL: `includes('noindex')` also matches `noindexifembedded`, a narrow directive meaning 'don't index when embedded in another page'. A site using it correctly gets a critical-priority hard failure claiming it is invisible to AI answer engines.
- Duplicate-tag flip: `parser.ts extractMetaTags` is last-wins (`meta[name.toLowerCase()] = content`). A page with `<meta name="robots" content="noindex">` in the template and a later `content="index,follow"` injected by a plugin reports 'index,follow' — and the reverse ordering produces a false failure. Real crawlers apply the most restrictive directive, not the last one.
- Empty-page green pass: `if (!robots) return this.pass('No meta robots tag found (not blocking by default)', …, page?.url)` executes when `ctx.pages` is empty (`page` is undefined). A scan where every fetch failed — DNS error, total WAF block, 503 — reports a critical-priority PASS. The test suite explicitly enshrines this: 'passes when there are no pages (not blocking by default)'.
- Only `ctx.pages[0]` is examined; a site whose homepage is indexable but whose entire /blog is noindexed passes.
- `extractMetaTags` drops `content=""`, so `<meta name="robots" content="">` is indistinguishable from absent — harmless here but part of the same blind spot.
- SPA/JS-injected robots directives are invisible in the fetched HTML.

**Test gaps:**
- No `content="none"` test — the highest-severity false pass is entirely unexercised.
- No `X-Robots-Tag` header test.
- No bot-specific meta tag test (`googlebot`, `google-extended`, `gptbot`).
- No `noindexifembedded` test (the substring false positive).
- No duplicate `<meta name="robots">` test.
- No multi-page test where an interior page is noindexed.
- The empty-pages test asserts `pass`, locking in the behavior that a totally failed scan reports a critical check as passing — the test encodes the bug as intended behavior.
- No `content="NOINDEX"` uppercase test (this one would pass, since the value is lowercased — but it is untested).

**Overlaps with:** _none_

## Evidence

### Signal: meta robots noindex/nofollow/nosnippet effect on AI crawlers — grade A (meta-head)

**Mechanism:** Robots directives in the head change AI-surface behavior directly: noindex removes the page from AI-search indexes, and nosnippet/noarchive/nocache prevent or truncate the page's use as input to generated answers. Falsifiable: if vendors documented that AI answer systems ignore head-level robots directives, the claim fails.

**Evidence:** This is the best-documented head signal in the domain, with three vendors making explicit AI-specific statements. Google: nosnippet "will also prevent the content from being used as a direct input for AI Overviews and AI Mode." Apple: nosnippet means "Apple will not use data tagged nosnippet as additional context and up-to-date content when AI models are used to generate output for display in Apple products and services," and noindex means the page "won't appear in Spotlight or Siri Suggestions"; Applebot also honors an applebot-scoped meta name and X-Robots-Tag. Microsoft: NOARCHIVE content "will not be included in Bing Chat answers, not be linked to in the answers"; NOCACHE content appears with "only ... URL/Snippet/Title." Google and Apple both note the crawlability precondition — a robots.txt-blocked page has its meta directives ignored entirely, which is the single highest-value misconfiguration an audit can catch.

**Counter-evidence:** Coverage is far from universal. Anthropic's crawler documentation names robots.txt and Crawl-delay only and never mentions meta tags, noindex, or X-Robots-Tag. A raw-HTML grep of OpenAI's live crawler docs returns zero occurrences of 'noindex' or 'meta tag'; the only reported OpenAI acknowledgement lives in a help-center FAQ that returns HTTP 403 to non-browser clients and I could not verify it. Perplexity's crawler doc says nothing about meta robots, and states Perplexity-User "generally ignores robots.txt rules" for user-initiated fetches. So: an A-grade signal for Google, Apple and Microsoft surfaces, and an undocumented one for Claude and Perplexity. Report per-engine rather than as a blanket 'AI crawlers honor this'.
**Consumers:** Googlebot — AI Overviews and AI Mode, Applebot — Siri, Spotlight, Apple Intelligence generation, Bingbot — Bing Chat / Microsoft Copilot, OAI-SearchBot (reported, unverified), none-documented for ClaudeBot/Claude-SearchBot and PerplexityBot · **Recommended tier:** scored

**Sources:** [Robots meta tag, data-nosnippet, and X-Robots-Tag specifications](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag) · [About Applebot](https://support.apple.com/en-us/119829) · [Announcing new options for webmasters to control usage of their content in Bing Chat](https://blogs.bing.com/webmaster/september-2023/Announcing-new-options-for-webmasters-to-control-usage-of-their-content-in-Bing-Chat) · [Announcing new options for webmasters to control their snippets at Bing](https://blogs.bing.com/webmaster/april-2020/Announcing-new-options-for-webmasters-to-control-their-snippets-at-Bing) · [AI Features and Your Website](https://developers.google.com/search/docs/appearance/ai-features) · [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) · [Publishers and Developers - FAQ](https://help.openai.com/en/articles/12627856-publishers-and-developers-faq) · [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) · [Perplexity Crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
