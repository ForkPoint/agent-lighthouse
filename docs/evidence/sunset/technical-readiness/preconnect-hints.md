---
audit: technical-readiness/preconnect-hints
category: technical-readiness
audit_id: "8.17"
source_file: packages/core/src/audits/technical-readiness/preconnect-hints.ts
slug: preconnect-hints
review_verdict: delete
severity: high
disposition: "sunset (approved 2026-08-21)"
status: sunset
verdict: dead
evidence_grade: D
reviewed: 2026-08-21
---

# preconnect-hints — confirmed dead — delete

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **D**.

## Claimed mechanism (steelmanned)

Steelmanned: crawlers operate under a crawl/render budget. Google itself says faster loading and rendering lets it read more content. Preconnect collapses DNS + TCP + TLS for a critical third-party origin, shaving hundreds of milliseconds off render completion. If an AI crawler renders the page (Gemini does, via Googlebot) or an agentic browser drives it live, faster render completion means more pages ingested per budget and fewer agent timeouts — so a missing preconnect hint costs AI content coverage.

## What we searched

All research by WebFetch. Angles: (1) the mechanism's precondition — does any AI crawler actually render? Fetched Vercel's large-scale AI-crawler telemetry study; (2) the budget claim at its source — fetched Google's "Large site owner's guide to managing crawl budget" to see exactly what Google says governs crawl capacity, and whether resource hints appear; (3) the tooling status — fetched Chrome's Lighthouse `uses-rel-preconnect` documentation for current status and overuse warnings, then tried the Lighthouse 13 release notes and insights docs (both 404'd; the deprecation statement on the audit page itself is the surviving citation); (4) Brave query `"preconnect" "AI crawler" crawl budget GPTBot rendering`; (5) the empirical GEO literature and AI-citation correlation studies for any speed or resource-hint factor. The mechanism's own precondition fails.

## Best evidence found for the audit

There is one real sentence in the neighbourhood, and it is the best this audit gets: Google's crawl-budget guide states "If Google can load and render your pages faster, we might be able to read more content from your site." Google does render (and Gemini rides Googlebot's rendering infrastructure per Vercel), so a rendering-budget argument is not absurd on its face. But the same document names the actual levers explicitly — crawl health measured by "response times (including latency and Time-to-First Byte)", server errors, rate-limiting — and never mentions resource hints, preconnect, prefetch, HTTP/2 push, or client-side subresource strategy at all. So the closest supporting source, read in full, points at server response time (which this project already audits separately as fast-response-time) rather than at preconnect. No AI vendor doc, no crawler doc, and no study anywhere connects preconnect to AI crawling; the targeted Brave search returned "Too few matches were found" and the term preconnect appeared in no result.

## Counter-evidence

Four positive disproofs. (1) The precondition fails for nearly all AI crawlers. Vercel's telemetry (https://vercel.com/blog/the-rise-of-the-ai-crawler): "none of the major AI crawlers currently render JavaScript" — OpenAI, Anthropic, Meta, ByteDance and Perplexity bots fetch JS as bytes without executing it; only Gemini renders. `rel=preconnect` is a hint acted on by a rendering engine's loading pipeline; a crawler that fetches HTML and stops never opens the speculative connection, so the hint is literally inert for GPTBot, ClaudeBot and PerplexityBot. (2) Google's own crawl-budget doc names server response time / TTFB and never resource hints — https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget. (3) Chrome deprecated the standalone audit: the Lighthouse `uses-rel-preconnect` page states "This audit has moved into the Network dependency tree insight as of Lighthouse 13", and warns that preconnect is actively harmful when misapplied — "This is especially bad if the connection isn't used within 10 seconds, as the browser closes it, wasting all of that early connection work" and it "can still take up valuable CPU time, particularly on secure connections". (4) The implementation inverts the correct test. Lighthouse flags *specific origins that would benefit*; this audit passes on `$('link[rel="preconnect"]').length > 0` (preconnect-hints.ts lines 41–56) and fails otherwise. It therefore rewards a site for having any preconnect at all — including exactly the unused, CPU-wasting preconnects Chrome warns about — and penalises a well-optimised single-origin site with no third parties, which is the ideal case for a crawler. The audit is negatively correlated with the outcome it claims to measure.

## Verdict

**confirmed dead — delete** (grade D)

Grade D. The causal chain requires a renderer, and the dominant AI crawlers do not render — so for GPTBot, ClaudeBot and PerplexityBot the signal is inert by construction. For the one crawler that does render (Gemini via Googlebot), Google's own crawl-budget documentation names server response time and TTFB, never resource hints, and that lever is already covered by the project's separate fast-response-time audit. Meanwhile Chrome folded the standalone preconnect audit into an insight in Lighthouse 13 and warns that unused preconnects waste connection work and CPU — and this audit's binary any-preconnect-present pass condition rewards precisely that anti-pattern while failing clean single-origin sites. Delete: no consumer, wrong mechanism, and a scoring rule that pushes sites in the harmful direction.

## Sources

- **[The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler)** — Vercel (study, URL verified 2026-08-21)
  - "none of the major AI crawlers currently render JavaScript." ChatGPT fetches JS files in 11.50% of requests and Claude 23.84%, but neither executes them. Only Gemini renders, by leveraging Googlebot's infrastructure. Preconnect, a render-pipeline hint, cannot be acted on by non-rendering crawlers.
- **[Large site owner's guide to managing your crawl budget](https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget)** — Google (vendor-doc, URL verified 2026-08-21)
  - Crawl capacity limit is governed by crawl health: "If the site responds consistently and its response times (including latency and Time-to-First Byte) remain stable or improve, the limit goes up." Also "If Google can load and render your pages faster, we might be able to read more content from your site." Does not mention resource hints, preconnect, prefetch, HTTP/2 push, or client-side subresource loading anywhere.
- **[Preconnect to required origins (uses-rel-preconnect)](https://developer.chrome.com/docs/lighthouse/performance/uses-rel-preconnect)** — Google Chrome Developers (vendor-doc, URL verified 2026-08-21)
  - "This audit has moved into the Network dependency tree insight as of Lighthouse 13." Warns against overuse: an unused preconnect is "especially bad if the connection isn't used within 10 seconds, as the browser closes it, wasting all of that early connection work", and preconnect "can still take up valuable CPU time, particularly on secure connections". Lighthouse flags specific beneficial origins rather than testing for mere presence.
- **[Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots)** — OpenAI (vendor-doc, URL verified 2026-08-21)
  - No mention of JavaScript rendering, page speed, or preconnect. Crawler control is robots.txt and published IP ranges only.
- **[Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)** — Anthropic (vendor-doc, URL verified 2026-08-21)
  - robots.txt directives and Crawl-delay only. No page-speed considerations, no resource hints (preload/prefetch/preconnect), no JS rendering capability documented.
- **[GEO: Generative Engine Optimization](https://arxiv.org/html/2311.09735v3)** — arXiv (Aggarwal et al., KDD 2024) (study, URL verified 2026-08-21)
  - Nine tested levers, all content-level (quotation +41%, statistics +39%, cite sources +28%, fluency, readability, etc.). No page-speed or resource-hint lever tested or discussed.

## v1 dossier — what it checked and the 2026-08-20 code review

Merged in on 2026-08-22 from `docs/evidence/audits/technical-readiness/preconnect-hints.md`, so a removed audit has exactly one dossier and it lives here.

### What it checks

Preconnect hints reduce the time AI crawlers spend establishing connections to third-party resources. Faster page loads mean AI agents can crawl more of your pages within their time budget, improving overall content coverage in AI knowledge bases.

### Code review findings (2026-08-20, 11-agent pass)

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

### Evidence

#### Signal: Preconnect hints and render-blocking resource elimination as AI-crawler signals — grade D (technical-infra)

**Mechanism:** CLAIM UNDER TEST: adding rel=preconnect/preload hints and removing render-blocking CSS/JS improves how AI crawlers ingest, index or cite the page. FALSIFIABLE FORM: adding preconnect hints to a page measurably changes GPTBot / ClaudeBot / PerplexityBot fetch or citation behaviour on otherwise identical content.

**Evidence:** No supporting evidence exists for the AI-crawler case, and the mechanism is affirmatively refuted for the dominant consumer class. Vercel and MERJ found zero JavaScript execution across GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot, Meta and ByteDance — these clients parse the raw HTML response and never construct a render tree. Resource hints (preconnect, preload, dns-prefetch) and render-blocking analysis are properties of a browser's critical rendering path; a client with no rendering path derives no benefit from either. The only crawler-side performance variable with documented effect is origin response latency, which Google ties directly to crawl volume ('If the site slows down... the limit goes down and Google crawls less') — that belongs to the TTFB signal, not here.

**Counter-evidence:** One partial exception, which should be scoped explicitly rather than used to rescue the signal: browser-resident agents (ChatGPT Atlas, Perplexity Comet, Gemini in Chrome, Claude in Chrome) and the two rendering crawlers — Gemini via Googlebot's evergreen Chromium, and Applebot, which Apple says 'may render the content of your website within a browser' — do execute JS and therefore do experience render-blocking cost. Even for those, the effect is on wall-clock task latency inside the agent, not on indexing or citation, and no vendor documents it. Likewise CLS and INP are unmeasurable for non-rendering clients. Recommend deleting these from the AI-readiness score; if retained at all, retain as generic web-performance context clearly labelled as human-user-facing, and route the genuinely load-bearing part (TTFB, HTML weight, clean status codes) into the fast-response-time audit.
**Consumers:** none-known among AI crawlers, browser-resident agents only, and only for task latency · **Recommended tier:** delete

**Sources:** [The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler) · [Large site owner's guide to managing your crawl budget](https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget) · [About Applebot](https://support.apple.com/en-us/119829) · [Google crawlers and fetchers (user agents) — Common crawlers](https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers) · [AI features and your website — Google Search Central](https://developers.google.com/search/docs/appearance/ai-features)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **sunset** (graceful sunset per evidence-policy deprecation process; condensed rationale kept in not-a-factor.md).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.

- 2026-08-22 — v1 dossier merged in from `docs/evidence/audits/technical-readiness/preconnect-hints.md`; that copy removed (one dossier per removed audit, under `sunset/`).
