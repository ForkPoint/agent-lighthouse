---
audit: content-extraction/server-rendered
audit_id: "8.13"
category: content-extraction
source_file: packages/core/src/audits/content-extraction/server-rendered.ts
slug: server-rendered
review_verdict: fix
severity: high
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# server-rendered (`8.13`)

> technical-readiness · source `server-rendered.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

AI crawlers like GPTBot and ClaudeBot do not execute JavaScript. Content only visible after JS execution is completely invisible to them, meaning your site effectively has no content in AI knowledge bases. Use SSR (server-side rendering) or SSG (static site generation) to serve content in the initial HTML response.

## Code review findings (2026-08-20, 11-agent pass)

The most valuable premise in the category — whether meaningful content exists in the initial HTML is genuinely decisive for AI crawlers — implemented with a threshold so low it barely discriminates. `if (wordCount > 50 || mainText.length > 200)` passes, where `getMainContentText` falls back to the whole `<body>` when there is no `<main>`. A React/Vue SPA shell that server-renders only its nav, cookie banner and footer clears 200 characters effortlessly and is reported as having 'meaningful server-rendered content' — the exact failure mode the audit exists to catch, waved through. In the other direction a legitimately image-led or short landing page is hit with a `critical` 0.0.

**Required fix:** Score the content region, not the whole body: when there is no `<main>`, subtract `header`/`nav`/`footer`/`[role=banner]`/`[role=contentinfo]`/cookie-banner nodes before measuring, and raise the bar to something discriminating (e.g. ≥ 150 words of non-boilerplate text, or ≥ 60% of the visible text living outside chrome). Replace the OR with an AND, or make the char branch a CJK-only fallback using a segmenter (`Intl.Segmenter`) so word counts are meaningful in non-space-delimited scripts. Evaluate every page in `ctx.pages` and report the worst/most-common outcome by page type rather than the homepage alone. Return `na` when WAF-blocked.

**False-positive risks:**
- Passes true CSR apps: no `<main>` ⇒ text is harvested from the entire `<body>`, so a nav + cookie notice + footer in the shell (well over 200 chars on any modern template) satisfies the gate while the actual product/article content is JS-only.
- OR-ed thresholds make the weaker one decisive: `wordCount > 50 || mainText.length > 200` — 200 characters is roughly 30 words of boilerplate, so the word test almost never binds.
- CJK/Thai word counting is broken: `getWordCount` does `text.split(/\s+/)` — an unsegmented Chinese or Japanese homepage counts as ~1 word and only survives via the character branch; a 150-character Japanese page with ample content fails as `critical`.
- Homepage-only: sites that SSR the marketing homepage and CSR every product/article page — a very common Next.js/Nuxt split — pass on the one page that was rendered and the crawlable-content problem on the pages that matter goes unreported, even though `ctx.pages` holds them.
- Hydration payloads are correctly excluded (`clone.find('script, style, noscript, template').remove()`), but text injected via `<template>` or shadow-DOM-only components is invisible to both the audit and, correctly, to crawlers — no distinction is drawn for the user.
- WAF challenge pages are short ⇒ reported as 'no server-rendered content, critical'.

**Test gaps:**
- No test with a realistic SPA shell (nav + footer + empty root div) — the case the audit is supposed to catch and currently passes.
- No test with a `<main>` element present but empty while `<body>` is full.
- No CJK/no-space-language test.
- No multi-page test (SSR homepage + CSR product page).
- No test comparing initial HTML against a rendered DOM, or any test of the 50-word branch independently of the 200-char branch.

**Overlaps with:** `8.14`, `8.21`

## Evidence

### Signal: SSR vs CSR — do GPTBot/ClaudeBot/PerplexityBot execute JavaScript? — grade B (technical-infra)

**Mechanism:** Content that exists in the DOM only after client-side JavaScript execution is invisible to the major non-rendering AI crawlers, which parse the raw HTML response only. FALSIFIABLE FORM: a page whose main content is injected client-side is fetched with HTTP 200 by GPTBot/ClaudeBot/PerplexityBot but the injected text never appears in those systems' answers or indexes, whereas an SSR/SSG equivalent does.

**Evidence:** This is the best-evidenced signal in the domain. Joint Vercel + MERJ instrumentation (Edge Middleware plus MERJ's Web Rendering Monitor, on nextjs.org with supplemental data from monogram.io and basement.io) found zero evidence of JavaScript execution across the major AI crawlers: OAI-SearchBot, ChatGPT-User, GPTBot, ClaudeBot, PerplexityBot, Meta's external agent and ByteDance's crawler. The crawlers still DOWNLOAD JS bundles as text — ChatGPT 11.50%, Claude 23.84% of requests — which is exactly the artefact you expect from a text extractor that fetches subresources without a render tree. Corroborated at scale by the same dataset's traffic figures (GPTBot 569M req/month, Claude 370M on Vercel's network).

**Counter-evidence:** The claim must be stated with named exceptions, or it is false. (a) Gemini renders JavaScript because it inherits Googlebot's evergreen-Chromium rendering infrastructure — Google documents Googlebot tracking 'the latest Chromium release version'. (b) Apple states directly that 'Applebot may render the content of your website within a browser' and that blocking JS/CSS/XHR in robots.txt breaks that rendering. (c) The entire browser-agent class — ChatGPT Atlas, Perplexity Comet, Gemini in Chrome, Claude in Chrome — is Chromium and executes JS exactly like a human visitor. (d) No bot vendor (OpenAI, Anthropic, Perplexity) has ever published a statement confirming or denying JS execution; the OpenAI bots page is silent on rendering. So this rests on third-party measurement, which is why it is B and not A. Finally, the finding is a snapshot: crawler capabilities can change without announcement, so the dossier should carry the measurement date.
**Consumers:** GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot, Meta external agent, Bytespider · **Recommended tier:** scored

**Sources:** [The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler) · [About Applebot](https://support.apple.com/en-us/119829) · [Google crawlers and fetchers (user agents) — Common crawlers](https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers) · [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) · [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) · [Perplexity Crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
