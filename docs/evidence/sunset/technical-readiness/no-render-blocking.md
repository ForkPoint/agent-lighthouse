---
audit: technical-readiness/no-render-blocking
audit_id: "8.14"
category: technical-readiness
source_file: packages/core/src/audits/technical-readiness/no-render-blocking.ts
slug: no-render-blocking
status: sunset
review_verdict: fix
severity: medium
evidence_grade: D
disposition: "removed — sunset 2026-08-21 (v2 taxonomy grading pass)"
reviewed: 2026-08-21
---

# no-render-blocking (`8.14`)

> technical-readiness · source `no-render-blocking.ts` · review verdict **fix** · evidence grade **D** · disposition: **removed — sunset 2026-08-21 (v2 taxonomy grading pass)**

## What it checks

Render-blocking scripts delay the HTML content that AI crawlers extract. Since AI agents do not execute JavaScript, blocking scripts add latency without providing any benefit to AI crawling. Use defer, async, or type="module" to unblock HTML delivery.

## Code review findings (2026-08-20, 11-agent pass)

Counts external `<head>` scripts lacking async/defer/module/nomodule. Two independent problems. (a) The stated rationale is factually wrong: 'the crawler waits for scripts to download but never runs them' — an HTTP crawler that does not execute JavaScript also does not fetch `<script src>` at all, so head scripts cost a non-executing AI crawler exactly nothing. The real cost is to agentic/headless browsers, which is a much narrower claim than the copy makes. (b) It ignores the dominant render-blocking resource entirely: `<link rel=stylesheet>` blocks rendering in every browser, `extractStylesheetUrls` already exists in parser.ts, and it is never called here. The audit measures the less important half of the problem while explaining it incorrectly.

**Required fix:** Filter by element rather than by src string — walk `$('head script[src]')` directly and evaluate async/defer/type on each matched element instead of intersecting with a Set of srcs. Add `<link rel=stylesheet>` in `<head>` (via the existing `extractStylesheetUrls`) as blocking resources, and count sizeable inline head scripts. Delete the `bodyText.length < 100` branch and defer that judgement to 8.13. Rewrite the impact copy: non-executing crawlers do not fetch scripts at all; the cost is borne by agentic/headless browsers and by Core Web Vitals.

**False-positive risks:**
- Matching by src string, not by element: `blockingScripts = allScripts.filter(s => … headScriptSrcs.has(s.src) && !s.async && !s.defer …)`. `headScriptSrcs` is a Set of head srcs, but the filter runs over ALL scripts on the page. A page with `<head><script src="a.js" defer>` plus `<body><script src="a.js">` flags the body copy as a head render-blocker — a false positive from ordinary duplicate-bundle markup.
- Stylesheets ignored: the single biggest render-blocking category is unmeasured, so a page with ten blocking stylesheets and zero blocking scripts reports 'No render-blocking synchronous scripts found' and scores 1.0.
- Inline `<head>` scripts (analytics snippets, dataLayer bootstraps, framework preamble) are counted into `totalHeadScripts` for display but never treated as blocking, although a large synchronous inline script blocks the parser just as hard as an external one.
- `type="module"` is treated as fully non-blocking; module scripts are deferred by default so this is right for the module itself, but `type="module"` with an inline blocking import graph still delays interactivity — over-credited.
- Scope creep into 8.13: the `bodyText.length < 100` branch inside the no-blocking path emits an 'appears to have no content' warn that re-decides server-rendered's question with a different (100-char) threshold, so the two audits can disagree with each other on the same page.
- `page.fetchResult.body ?? ''` measures the raw HTML string length, not text, so 'body is only N characters' is describing the whole document, not the body content — the message misstates what was measured.

**Test gaps:**
- No test with the same src appearing deferred in head and undeferred in body (the src-matching false positive).
- No test with blocking `<link rel=stylesheet>` — the missing half.
- No test with a large inline head script.
- No test for `<script src>` with an absolute cross-origin URL vs relative, or duplicate srcs generally.
- No test asserting the <100-char warn branch agrees with 8.13's verdict on the same HTML.

**Overlaps with:** `8.13`

## Evidence

### Signal: Preconnect hints and render-blocking resource elimination as AI-crawler signals — grade D (technical-infra)

**Mechanism:** CLAIM UNDER TEST: adding rel=preconnect/preload hints and removing render-blocking CSS/JS improves how AI crawlers ingest, index or cite the page. FALSIFIABLE FORM: adding preconnect hints to a page measurably changes GPTBot / ClaudeBot / PerplexityBot fetch or citation behaviour on otherwise identical content.

**Evidence:** No supporting evidence exists for the AI-crawler case, and the mechanism is affirmatively refuted for the dominant consumer class. Vercel and MERJ found zero JavaScript execution across GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot, Meta and ByteDance — these clients parse the raw HTML response and never construct a render tree. Resource hints (preconnect, preload, dns-prefetch) and render-blocking analysis are properties of a browser's critical rendering path; a client with no rendering path derives no benefit from either. The only crawler-side performance variable with documented effect is origin response latency, which Google ties directly to crawl volume ('If the site slows down... the limit goes down and Google crawls less') — that belongs to the TTFB signal, not here.

**Counter-evidence:** One partial exception, which should be scoped explicitly rather than used to rescue the signal: browser-resident agents (ChatGPT Atlas, Perplexity Comet, Gemini in Chrome, Claude in Chrome) and the two rendering crawlers — Gemini via Googlebot's evergreen Chromium, and Applebot, which Apple says 'may render the content of your website within a browser' — do execute JS and therefore do experience render-blocking cost. Even for those, the effect is on wall-clock task latency inside the agent, not on indexing or citation, and no vendor documents it. Likewise CLS and INP are unmeasurable for non-rendering clients. Recommend deleting these from the AI-readiness score; if retained at all, retain as generic web-performance context clearly labelled as human-user-facing, and route the genuinely load-bearing part (TTFB, HTML weight, clean status codes) into the fast-response-time audit.
**Consumers:** none-known among AI crawlers, browser-resident agents only, and only for task latency · **Recommended tier:** delete

**Sources:** [The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler) · [Large site owner's guide to managing your crawl budget](https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget) · [About Applebot](https://support.apple.com/en-us/119829) · [Google crawlers and fetchers (user agents) — Common crawlers](https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers) · [AI features and your website — Google Search Central](https://developers.google.com/search/docs/appearance/ai-features)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
