---
audit: technical-readiness/preconnect-hints
audit_id: "8.17"
category: technical-readiness
source_file: packages/core/src/audits/technical-readiness/preconnect-hints.ts
slug: preconnect-hints
review_verdict: delete
severity: high
evidence_grade: D
disposition: "sunset (approved 2026-08-21)"
reviewed: 2026-08-21
---

# preconnect-hints (`8.17`)

> technical-readiness · source `preconnect-hints.ts` · review verdict **delete** · evidence grade **D** · disposition: **sunset (approved 2026-08-21)**

## What it checks

Preconnect hints reduce the time AI crawlers spend establishing connections to third-party resources. Faster page loads mean AI agents can crawl more of your pages within their time budget, improving overall content coverage in AI knowledge bases.

## Code review findings (2026-08-20, 11-agent pass)

Fails any page without at least one `<link rel="preconnect">`. This is inverted guidance, not a weak signal. A site that self-hosts its fonts and assets and has no third-party origins SHOULD have zero preconnects — adding them, as this audit instructs, opens speculative connections to nothing and is a documented anti-pattern; Lighthouse's own `uses-rel-preconnect` only fires when there are measured origins that would actually benefit, and explicitly warns against preconnecting to unused origins. This audit inverts that into 'more preconnects = better' and hands a 0.0 to the best-architected sites in its sample. On top of that, preconnect is a browser resource-loading hint with no effect whatsoever on an HTTP crawler that fetches one HTML document and never touches a subresource — so the stated benefit ('AI crawlers can crawl more of your pages within their time budget') cannot occur.

**Required fix:** Delete. If a resource-hint audit is genuinely wanted, it must be inverted to match Lighthouse semantics: collect the page's cross-origin subresource origins (scripts, stylesheets, fonts, images), and flag only those high-value origins that lack a preconnect — while also flagging preconnects to origins the page never requests. Until that exists, this audit hands out actively harmful advice and should not ship.

**False-positive risks:**
- Punishes the optimal configuration: a fully self-hosted site with no cross-origin dependencies has nothing to preconnect to and is failed, then instructed to add `<link rel="preconnect" href="https://fonts.googleapis.com">` — i.e. to introduce a third-party dependency it does not have.
- Exact attribute-value selector: `$('link[rel="preconnect"]')` is a literal match. `rel="preconnect dns-prefetch"` (a very common combined form), `rel="Preconnect"`, or extra whitespace all fail to match, so sites that DO preconnect are reported as having none.
- Counts without validating: any preconnect passes, including one to an origin the page never contacts (pure waste) — the existing test even asserts that a `<link rel="preconnect">` with no href counts toward the passing total.
- No cross-check against actual cross-origin subresources on the page, which is the only way to know whether a preconnect is warranted.
- Homepage-only, and irrelevant to non-executing crawlers by construction.

**Test gaps:**
- No test for `rel="preconnect dns-prefetch"` or mixed-case rel (both currently fail to match).
- No test for a self-hosted site with no third-party origins, where failing is the wrong answer.
- No test for a preconnect pointing at an origin the page never uses.
- No test correlating preconnects against the page's actual cross-origin resource list.

**Overlaps with:** _none_

## Evidence

### Signal: Preconnect hints and render-blocking resource elimination as AI-crawler signals — grade D (technical-infra)

**Mechanism:** CLAIM UNDER TEST: adding rel=preconnect/preload hints and removing render-blocking CSS/JS improves how AI crawlers ingest, index or cite the page. FALSIFIABLE FORM: adding preconnect hints to a page measurably changes GPTBot / ClaudeBot / PerplexityBot fetch or citation behaviour on otherwise identical content.

**Evidence:** No supporting evidence exists for the AI-crawler case, and the mechanism is affirmatively refuted for the dominant consumer class. Vercel and MERJ found zero JavaScript execution across GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot, Meta and ByteDance — these clients parse the raw HTML response and never construct a render tree. Resource hints (preconnect, preload, dns-prefetch) and render-blocking analysis are properties of a browser's critical rendering path; a client with no rendering path derives no benefit from either. The only crawler-side performance variable with documented effect is origin response latency, which Google ties directly to crawl volume ('If the site slows down... the limit goes down and Google crawls less') — that belongs to the TTFB signal, not here.

**Counter-evidence:** One partial exception, which should be scoped explicitly rather than used to rescue the signal: browser-resident agents (ChatGPT Atlas, Perplexity Comet, Gemini in Chrome, Claude in Chrome) and the two rendering crawlers — Gemini via Googlebot's evergreen Chromium, and Applebot, which Apple says 'may render the content of your website within a browser' — do execute JS and therefore do experience render-blocking cost. Even for those, the effect is on wall-clock task latency inside the agent, not on indexing or citation, and no vendor documents it. Likewise CLS and INP are unmeasurable for non-rendering clients. Recommend deleting these from the AI-readiness score; if retained at all, retain as generic web-performance context clearly labelled as human-user-facing, and route the genuinely load-bearing part (TTFB, HTML weight, clean status codes) into the fast-response-time audit.
**Consumers:** none-known among AI crawlers, browser-resident agents only, and only for task latency · **Recommended tier:** delete

**Sources:** [The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler) · [Large site owner's guide to managing your crawl budget](https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget) · [About Applebot](https://support.apple.com/en-us/119829) · [Google crawlers and fetchers (user agents) — Common crawlers](https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers) · [AI features and your website — Google Search Central](https://developers.google.com/search/docs/appearance/ai-features)

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/technical-readiness/preconnect-hints.md](../../deletions/technical-readiness/preconnect-hints.md). Outcome: **dead**, grade D.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
