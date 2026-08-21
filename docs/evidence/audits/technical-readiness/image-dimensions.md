---
audit: technical-readiness/image-dimensions
audit_id: "8.15"
category: technical-readiness
source_file: packages/core/src/audits/technical-readiness/image-dimensions.ts
slug: image-dimensions
review_verdict: fix
severity: medium
evidence_grade: D
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# image-dimensions (`8.15`)

> technical-readiness · source `image-dimensions.ts` · review verdict **fix** · evidence grade **D** · disposition: **keep — fix required**

## What it checks

AI agents that use visual screenshots (like Claude computer use) need stable page layouts to identify interactive elements. Missing image dimensions cause layout shifts that move elements between screenshots, breaking coordinate-based click targeting in agentic workflows.

## Code review findings (2026-08-20, 11-agent pass)

Requires `width` and `height` attributes on every `<img>` and fails/warns on the ratio. The underlying concern (layout stability) is legitimate but the check is stuck in 2020: reserving space via CSS `aspect-ratio` on the img — the modern, framework-default approach, and what Next.js/Astro/Nuxt image components emit alongside or instead of attributes — is invisible to it, so correctly-stable pages are failed. The AI-specific rationale ('breaks coordinate-based click targeting in agentic workflows') is also weak speculation: current computer-use agents re-screenshot before acting, so a shift between frames does not persist as a mis-click. Net: a CLS audit wearing an AI costume, with a detection method that misses the common correct implementation.

**Required fix:** Accept CSS-based reservation: treat an img as sized if it has width+height attributes OR an inline/`style` `aspect-ratio` OR both dimensions in an inline style. Reject `width="0"`/`height="0"` as unset. Exclude tracking pixels and placeholders (declared ≤ 2px, empty src with a `data-src`/`data-lazy` sibling attribute) from the denominator. Return `notApplicable()` when there are no images. Rewrite the impact away from 'breaks coordinate-based click targeting' toward the honest CLS/Core-Web-Vitals framing, and evaluate all pages rather than only the homepage.

**False-positive risks:**
- CSS-based space reservation not recognized: only `$(el).attr('width')`/`attr('height')` are read. `<img style="aspect-ratio:16/9">`, a padding-hack wrapper, or a CSS class fixing the box all yield zero CLS and are still counted in `withoutDimensions`.
- `<picture>`/`<source>` and `srcset` responsive setups where intrinsic size is carried by the sources are judged solely on the fallback `<img>`.
- `width="0"` passes: `!img.width` on the string `"0"` is false, so an explicit zero-size attribute counts as 'has dimensions'.
- Filter is too narrow: `src !== '#' && !src?.startsWith('data:image/')` excludes data URIs but not 1x1 tracking pixels, spacer GIFs, or `src=""` placeholders in lazy-loading libraries (which typically carry the real URL in `data-src`) — these inflate the denominator and drag legitimate pages below the 0.5 ratio into `fail`.
- Homepage-only, and the arbitrary 0.5 ratio boundary means one extra tracking pixel can move a site from `warn` to `fail`.
- Vacuous pass: `images.length === 0` ⇒ `this.pass('No images found on the homepage.')` — a free 1.0 for having nothing to check, where `notApplicable()` is the correct result.

**Test gaps:**
- No test with `style="aspect-ratio: …"` or a CSS-sized image (the main false positive).
- No test with `<picture>`/`<source>`/`srcset`.
- No test with `width="0"`.
- No test with lazy-loading placeholders (`src=""` + `data-src`) or tracking pixels.
- No test asserting the zero-image case should be `na` rather than a scored pass.

**Overlaps with:** `8.16`

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
