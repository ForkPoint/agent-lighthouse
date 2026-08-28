---
audit: content-extraction/server-rendered
category: content-extraction
source_file: packages/core/src/audits/content-extraction/server-rendered.ts
slug: server-rendered
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: scored
consumers:
  - GPTBot
  - OAI-SearchBot
  - ChatGPT-User
  - ClaudeBot
  - PerplexityBot
  - Meta external agent
  - Bytespider
signals:
  - name: "SSR vs CSR — do GPTBot/ClaudeBot/PerplexityBot execute JavaScript?"
    grade: B
    domain: technical-infra
sources:
  - vercel-rise-of-ai-crawler
  - applebot-doc
  - google-common-crawlers
  - s18
  - anthropic-crawlers
  - perplexity-crawlers-docs
---

# server-rendered (`8.13`)

> technical-readiness · source `server-rendered.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

AI crawlers like GPTBot and ClaudeBot do not execute JavaScript. Content only visible after JS execution is completely invisible to them, meaning your site effectively has no content in AI knowledge bases. Use SSR (server-side rendering) or SSG (static site generation) to serve content in the initial HTML response.

The audit measures each fetched page's served HTML body — everything inside `<body>` except `script`, `style`, `noscript` and `template`. A page counts as served when that text runs to more than 50 whitespace-delimited words or more than 200 characters. The character branch carries pages written in scripts that do not delimit words with spaces, where a word count of six can still mean several hundred characters of real copy.

The verdict is the ratio. Every fetched page served: pass. Some but not all: warn, with the empty URLs listed. None: fail, at critical priority. A scan that fetched no page reports not applicable, because nothing about the site was seen.

The measurement covers the whole body, page chrome included. A shell that serves only a navigation bar and a footer is the case the audit exists to catch, so that chrome has to be counted, not subtracted.

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

**Mechanism:** Content that exists in the DOM only after client-side JavaScript execution is invisible to the major non-rendering AI crawlers, which parse the raw HTML response only. Falsifiable form: a page whose main content is injected client-side is fetched with HTTP 200 by GPTBot/ClaudeBot/PerplexityBot but the injected text never appears in those systems' answers or indexes, whereas an SSR/SSG equivalent does.

**Grade: B** — The best-evidenced signal in this domain, and measured rather than claimed: joint Vercel and MERJ instrumentation on nextjs.org, with supplemental data from two other sites, found zero JavaScript execution across OAI-SearchBot, ChatGPT-User, GPTBot, ClaudeBot and PerplexityBot. Independent instrumentation of named tokens is strong evidence; what keeps it off A is that no vendor states the limitation itself, so the finding rests on observation of behaviour that could change silently. The exceptions are named in the audit rather than smoothed over: Gemini inherits Googlebot's evergreen-Chromium rendering, and Apple documents that "Applebot may render the content of your website within a browser".

**Evidence:** This is the best-evidenced signal in the domain. Vercel and MERJ ran joint instrumentation: Edge Middleware plus MERJ's Web Rendering Monitor, on nextjs.org, with supplemental data from monogram.io and basement.io. It found zero evidence of JavaScript execution across the major AI crawlers: OAI-SearchBot, ChatGPT-User, GPTBot, ClaudeBot, PerplexityBot, Meta's external agent and ByteDance's crawler. The crawlers still DOWNLOAD JS bundles as text — ChatGPT 11.50%, Claude 23.84% of requests — which is exactly the artefact you expect from a text extractor that fetches subresources without a render tree. Corroborated at scale by the same dataset's traffic figures (GPTBot 569M req/month, Claude 370M on Vercel's network).

**Counter-evidence:** The claim must be stated with named exceptions, or it is false. (a) Gemini renders JavaScript because it inherits Googlebot's evergreen-Chromium rendering infrastructure — Google documents Googlebot tracking 'the latest Chromium release version'. (b) Apple states directly that 'Applebot may render the content of your website within a browser' and that blocking JS/CSS/XHR in robots.txt breaks that rendering. (c) The entire browser-agent class — ChatGPT Atlas, Perplexity Comet, Gemini in Chrome, Claude in Chrome — is Chromium and executes JS exactly like a human visitor. (d) No bot vendor (OpenAI, Anthropic, Perplexity) has ever published a statement confirming or denying JS execution; the OpenAI bots page is silent on rendering. So this rests on third-party measurement, which is why it is B and not A. Finally, the finding is a snapshot: crawler capabilities can change without announcement, so the dossier should carry the measurement date.

## Implementation deviations

- 2026-08-26 — the text metric was moved off `getMainContentText`. That helper reads a page's main content region, and it returned the first `<main>` element whenever any existed. Measured on real storefronts (design section 2.4): `velasca.com` ships one empty `<main>` with 194 words elsewhere in the body, and `hiutdenim.co.uk` ships four `<main>` elements of which the first holds 49 characters. Both were reported as serving no content. The audit now reads a new helper, `getRenderedText`, which returns the served `<body>` minus `script`, `style`, `noscript` and `template`. The word count comes from that same text.
- 2026-08-26 — `getMainContentText` itself was corrected in the same change. Among several `<main>` elements it now returns the one holding the most text, and falls back to `<body>` only when none holds any. This affects the content audits that read it, not this one.
- The threshold is unchanged: more than 50 words or more than 200 characters.
- 2026-08-26 — the audit now judges every fetched page instead of `ctx.pages[0]`, and reports how many of them served readable text. The code review below records the reason: a site that server-renders its marketing homepage and client-renders every product page passed on the one page that was rendered, while the pages that matter went unreported. The empty URLs are carried in `details.emptyPages`.
- 2026-08-26 — the per-page decision is read from the scan's evidence record rather than recomputed here, so the rule has one implementation. A page the record does not cover is judged by that same shared function.
- 2026-08-26 — a scan with no fetched page returns `notApplicable`, where it previously returned `warn`. A warning is a claim about the site; the accurate statement is that nothing was seen.
- 2026-08-28 — the audit declines when the scan holds no response it can
  attribute to this site. It read the served body of each scanned page, and
  `ctx.pages`/`ctx.rootFiles` carry whatever answered 200 — on a parked domain
  a broker's page from another host, on a walled or throttled origin nothing
  at all. It now consults `scanReadTheSite()` and returns `notApplicable`
  carrying the gate's own reason.
  Verdicts that moved on the five nothing-obtained contract states: redirected
  away pass → na, non-HTML homepage fail → na, HTTP 200 bot challenge fail →
  na. Found by `packages/core/src/tests/hostile-state-contract.test.ts`.

## Deferred

- Turning the `or` into an `and`, as the code review below asks. The character branch is the only path a page written in a non-space-delimited script can take, so removing it would fail CJK homepages that carry ample content.
- Scoring the content region rather than the served body, as the code review below asks. The audit's subject is what a non-rendering crawler receives, and a shell that ships only a navigation bar and a footer is what it exists to catch, so the chrome is part of the measurement. The consequence is stated plainly: a template whose chrome alone clears 200 characters passes this check. Raising the bar is a separate change, and the evidence gate design (section 6.3) keeps this rule as the single implementation.
- Raising the threshold itself. A page clears the bar at 51 words, which is a low bar for a real page; what the right number is has not been measured, so the shipped rule keeps the one the evidence gate design fixed as the single implementation.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-26 — text metric split; see Implementation deviations.
- 2026-08-26 — judgement widened from the homepage to every fetched page; see Implementation deviations.
