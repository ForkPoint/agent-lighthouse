---
audit: technical-readiness/lcp-not-lazy
audit_id: "8.16"
category: technical-readiness
source_file: packages/core/src/audits/technical-readiness/lcp-not-lazy.ts
slug: lcp-not-lazy
status: sunset
review_verdict: fix
severity: high
evidence_grade: D
disposition: "removed — sunset 2026-08-21 (v2 taxonomy grading pass)"
reviewed: 2026-08-21
---

# lcp-not-lazy (`8.16`)

> technical-readiness · source `lcp-not-lazy.ts` · review verdict **fix** · evidence grade **D** · disposition: **removed — sunset 2026-08-21 (v2 taxonomy grading pass)**

## What it checks

AI agents that use visual screenshots see a blank placeholder for lazy-loaded hero images, missing critical visual context. For Core Web Vitals, lazy-loading the LCP element also degrades your performance score, which AI trust-scoring systems factor into content quality rankings.

## Code review findings (2026-08-20, 11-agent pass)

The comment `// The first image is a reasonable proxy for the LCP element` is the whole audit, and it is not a reasonable proxy. `extractImages` returns `<img>` elements in DOM order, so `images[0]` on a normal site is the header logo — not the LCP element. This produces errors in both directions and the messages are stated with unearned confidence ('The first image (likely LCP element) has loading="lazy"'). A site that lazy-loads its hero as the fifth `<img>` is told its LCP is fine; a site whose first `<img>` is a lazy 1x1 tracking pixel is told its most important content is delayed, at priority `high`.

**Required fix:** Stop asserting LCP from DOM position. Pick a candidate set instead: images that are not inside `<header>`/`<nav>`, whose declared dimensions (or CSS) exceed a size floor (e.g. ≥ 200px in either axis), or that carry `fetchpriority="high"`/a matching `<link rel=preload as=image>`; fail only when a candidate meeting those criteria is `loading="lazy"`. If no confident candidate exists, return `notApplicable()` rather than guessing. Soften the copy from 'likely LCP element' to name the specific element inspected, and reduce priority to `medium` given the inference is heuristic.

**False-positive risks:**
- First-in-DOM ≠ LCP: a header logo, a nav icon, a cart badge, or a tracking pixel is `images[0]` on the overwhelming majority of sites. If any of those carries `loading="lazy"` (common for pixels and secondary icons) the audit fails the site with a hero-image explanation that does not apply.
- False negatives are equally likely: the actual hero, appearing after the header markup, can be `loading="lazy"` and the audit will report a clean pass because element 0 was fine.
- LCP is frequently not an `<img>` at all — a CSS `background-image`, a `<video>` poster, or a large text block. None are considered, so 'LCP element not lazy-loaded' is asserted about pages whose LCP the audit never saw.
- `<picture>`/`<source>`-driven heroes and images inside `<template>`/`<noscript>` are mis-ordered or mis-counted by the flat `$('img')` traversal.
- No account of `fetchpriority="high"`, `preload`, or above-the-fold position — all the signals that would actually identify an LCP candidate — even though the guidance recommends `fetchpriority="high"` as the fix.
- Vacuous pass: `images.length === 0` ⇒ `this.pass(…)` — a free 1.0 rather than `na`.

**Test gaps:**
- No test where the first img is a logo/tracking pixel and the hero is later in the DOM — both the false-fail and the false-pass direction are untested.
- No test with a CSS background-image hero or a `<picture>` hero.
- No test with `fetchpriority="high"` on a later image.
- No test with images inside `<noscript>`/`<template>`.
- No test asserting the zero-image case should be `na`.

**Overlaps with:** `8.15`

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
