---
audit: technical-readiness/framework-detection
audit_id: "8.21"
category: technical-readiness
source_file: packages/core/src/audits/technical-readiness/framework-detection.ts
slug: framework-detection
review_verdict: delete
severity: medium
evidence_grade: D
disposition: "sunset (approved 2026-08-21)"
reviewed: 2026-08-21
---

# framework-detection (`8.21`)

> technical-readiness · source `framework-detection.ts` · review verdict **delete** · evidence grade **D** · disposition: **sunset (approved 2026-08-21)**

## What it checks

AI agents can optimize their interaction strategy if they know the underlying technology stack (e.g., React, Next.js, Vue). This also helps identify potential client-side rendering issues.

## Code review findings (2026-08-20, 11-agent pass)

Declared `scoreDisplayMode: 'informative'`, but `scorer.ts` never reads that field — it only excludes `status === 'na'` — so this is a fully scored audit whose every real-scan branch returns `pass()` (score 1.0). Both outcomes pass: frameworks detected, and 'No specific frontend framework clearly detected'. The only failing path requires `ctx.pages` to be empty. It is therefore a guaranteed free point (~4.8% of the category score) awarded to every site regardless of anything about it, which quietly inflates technical-readiness across the board. The detection logic is also unsound in several places, and even when correct it produces no actionable output — `guidance.fix` literally begins 'No action required.'

**Required fix:** Delete from the scored set. If framework identification is wanted for report context, move it out of `audits/` into scan metadata (a field on the report alongside `wafProtection`), or return `notApplicable()` so `scorer.ts` excludes it — and fix the detection while doing so: drop the `window.__NUXT__` dead branch, replace `[data-v-]` with a regex over attribute names (`/^data-v-[0-9a-f]{6,}$/`), anchor the src substring checks to path boundaries, and report `meta[generator]` under a 'CMS/generator' label distinct from frontend framework.

**False-positive risks:**
- Dead selector: `$('[data-v-field], [data-v-]')` — Vue SFC scoped styles emit hashed attributes like `data-v-7ba5bd90`; `[data-v-]` is an attribute-name selector matching only a literal attribute named `data-v-`, which never exists. Vue detection therefore rests entirely on `script[src*="vue"]`, and most bundled Vue apps ship `/assets/index-<hash>.js` with no 'vue' in the path → Vue sites report as 'Generic/Unknown'.
- Dead code: `(globalThis as {window?: {__NUXT__?: unknown}}).window?.__NUXT__` — the audit runs in Node against a fetched string; there is no `window`, and even if there were it would describe the scanner's global, not the scanned site.
- Substring src matching over-fires: `script[src*="react"]` matches `/js/reaction-tracker.js` or a `preact` bundle; `script[src*="astro"]` would match any path containing 'astro' (e.g. a vendor named Astro); `script[src*="vue"]` matches `/revue-widget.js`.
- `meta[generator]` is reported as a 'framework': a WordPress or Drupal site yields 'Generator: WordPress 6.0' under a heading about frontend frameworks (its own test asserts this), conflating CMS with rendering strategy.
- Double-reporting: a Next.js site matches both the Next.js branch and the React branch and is listed as both, with no hierarchy.
- Guaranteed pass: with any page present, one of the two `pass()` returns always fires, so the audit cannot discriminate between sites at all.

**Test gaps:**
- No test proving `[data-v-]` never matches a real Vue-scoped attribute like `data-v-7ba5bd90` — the suite tests `data-v-field`, an attribute Vue does not emit.
- No test for false-positive substring matches (`reaction-tracker.js`, `preact`, `revue`).
- No test with a modern hashed-bundle SPA (`/assets/index-a1b2c3.js`) where every selector misses.
- No test asserting the audit's score contribution — the always-pass score inflation is invisible to the suite.
- No test that `scoreDisplayMode: 'informative'` actually excludes it from scoring (it does not).

**Overlaps with:** `8.13`

## Evidence

### Signal: SSR vs CSR — do GPTBot/ClaudeBot/PerplexityBot execute JavaScript? — grade B (technical-infra)

**Mechanism:** Content that exists in the DOM only after client-side JavaScript execution is invisible to the major non-rendering AI crawlers, which parse the raw HTML response only. FALSIFIABLE FORM: a page whose main content is injected client-side is fetched with HTTP 200 by GPTBot/ClaudeBot/PerplexityBot but the injected text never appears in those systems' answers or indexes, whereas an SSR/SSG equivalent does.

**Evidence:** This is the best-evidenced signal in the domain. Joint Vercel + MERJ instrumentation (Edge Middleware plus MERJ's Web Rendering Monitor, on nextjs.org with supplemental data from monogram.io and basement.io) found zero evidence of JavaScript execution across the major AI crawlers: OAI-SearchBot, ChatGPT-User, GPTBot, ClaudeBot, PerplexityBot, Meta's external agent and ByteDance's crawler. The crawlers still DOWNLOAD JS bundles as text — ChatGPT 11.50%, Claude 23.84% of requests — which is exactly the artefact you expect from a text extractor that fetches subresources without a render tree. Corroborated at scale by the same dataset's traffic figures (GPTBot 569M req/month, Claude 370M on Vercel's network).

**Counter-evidence:** The claim must be stated with named exceptions, or it is false. (a) Gemini renders JavaScript because it inherits Googlebot's evergreen-Chromium rendering infrastructure — Google documents Googlebot tracking 'the latest Chromium release version'. (b) Apple states directly that 'Applebot may render the content of your website within a browser' and that blocking JS/CSS/XHR in robots.txt breaks that rendering. (c) The entire browser-agent class — ChatGPT Atlas, Perplexity Comet, Gemini in Chrome, Claude in Chrome — is Chromium and executes JS exactly like a human visitor. (d) No bot vendor (OpenAI, Anthropic, Perplexity) has ever published a statement confirming or denying JS execution; the OpenAI bots page is silent on rendering. So this rests on third-party measurement, which is why it is B and not A. Finally, the finding is a snapshot: crawler capabilities can change without announcement, so the dossier should carry the measurement date.
**Consumers:** GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot, Meta external agent, Bytespider · **Recommended tier:** scored

**Sources:** [The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler) · [About Applebot](https://support.apple.com/en-us/119829) · [Google crawlers and fetchers (user agents) — Common crawlers](https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers) · [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) · [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) · [Perplexity Crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/technical-readiness/framework-detection.md](../../deletions/technical-readiness/framework-detection.md). Outcome: **dead**, grade D.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
