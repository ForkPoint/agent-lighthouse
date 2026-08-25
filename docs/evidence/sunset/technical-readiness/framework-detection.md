---
audit: technical-readiness/framework-detection
category: technical-readiness
audit_id: "8.21"
source_file: packages/core/src/audits/technical-readiness/framework-detection.ts
slug: framework-detection
review_verdict: delete
severity: medium
disposition: "sunset (approved 2026-08-21)"
status: sunset
verdict: dead
evidence_grade: D
reviewed: 2026-08-21
---

# framework-detection — confirmed dead — delete

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **D**.

## Claimed mechanism (steelmanned)

Steelmanned two ways. (a) Diagnostic proxy: framework identity predicts rendering mode, so detecting Create React App or a Vue SPA is an early warning that the page is invisible to non-rendering AI crawlers, and detecting Next.js/Astro/Nuxt predicts server-rendered HTML. (b) Agent interaction: an AI browsing agent that knows the stack could adapt its strategy — waiting for hydration, expecting client-side routing, targeting framework-specific DOM hooks. For the audit to matter, either a named AI consumer must treat framework identity as a signal, or framework identity must carry rendering information not already obtainable by looking at the delivered HTML.

## What we searched

With WebSearch exhausted I fetched Google's JavaScript SEO Basics doc, the authoritative vendor statement on whether framework choice matters versus rendering outcome. I checked OpenAI's crawler docs, Anthropic's crawler support article, and Perplexity's bot docs for any statement about rendering capability or framework handling. Via the arXiv API I enumerated 30 recent GEO/AEO papers and fetched 'Designing Agent-Ready Websites for AI Web Agents' (2607.12056), the paper most directly aimed at this product's problem space, to see whether framework detection appears anywhere in an agent-readiness framework. I also read the sibling audit technical-readiness/server-rendered.ts in the codebase to test whether framework detection adds any information beyond it, and read framework-detection.ts's own detection logic.

## Best evidence found for the audit

Weakest of the four. The best I found is indirect and cuts against the audit: Google confirms not all crawlers render — 'server-side or pre-rendering is still a great idea because it makes your website faster for users and crawlers, and not all bots can run JavaScript' — which validates the RENDERING concern but says nothing about framework identity. No vendor doc from Google, OpenAI, Anthropic, Microsoft or Perplexity names a framework or treats framework choice as a factor. The academic paper purpose-built for agent-readiness (2607.12056) structures the problem as 'agent interpretability, agent executability, and agent decision reliability' via 'machine readability, semantic clarity, agent actionability, and contextual decision-reliability signals' — framework identity is not a dimension. No named consumer of this signal exists.

## Counter-evidence

(1) Google states the opposite of the audit's premise. Its JavaScript SEO guidance names no framework and frames the question purely as rendering outcome: content must be in the DOM, links must be real <a href> anchors, 'once Google's resources allow, a headless Chromium renders the page'. Framework choice is presented as irrelevant to Google's ability to process the page. (2) The audit is fully redundant with a sibling that measures the outcome directly: technical-readiness/server-rendered.ts (id 8.13, priority critical) counts words and characters in the delivered <main> and fails when content is absent — that is the real, ground-truth measurement of the only thing framework identity was proxying for. A proxy is strictly worse than the direct measurement it stands in for and is already sitting next to it. (3) The audit cannot produce a finding: scoreDisplayMode is 'informative' and every code path returns this.pass(), including the 'No specific frontend framework clearly detected' branch, so it never fails, never warns, and never surfaces an action — its own guidance says 'No action required.' (4) Its detection is additionally unsound: '[data-v-]' is not a valid attribute-prefix selector (Vue emits hashed attributes like data-v-7ba5bd90, which this never matches); the Nuxt branch reads (globalThis as {window}).window?.__NUXT__, which is always undefined in the Node scanner since there is no browser context; and script[src*="react"] / script[src*="vue"] match any bundle filename containing those substrings, so the output is unreliable even as trivia. (5) No AI crawler doc discloses rendering behavior at all (OpenAI, Anthropic, Perplexity docs are silent), so framework identity cannot even be mapped to a known consumer's capability.

## Verdict

**confirmed dead — delete** (grade D)

Grade D. There is no documented consumer: no vendor treats framework choice as an AI-readiness factor, and Google explicitly frames the issue as rendering outcome rather than tooling. The purpose-built agent-readiness literature does not include framework identity among its dimensions. The audit is a strictly inferior proxy for server-rendered.ts, which already measures the actual outcome at critical priority; it is hard-wired to always pass and self-describes as requiring no action; and its detection heuristics are broken in three separate places. Delete it. If stack identification is wanted for report colour, it belongs in scan metadata, not as an audit — and it should not be presented as an AI-readiness signal.

## Sources

- **[JavaScript SEO Basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)** — Google Search Central (vendor-doc, URL verified 2026-08-21)
  - Names no JavaScript framework and never states that framework choice matters. Frames everything as rendering outcome: 'Keep in mind that server-side or pre-rendering is still a great idea because it makes your website faster for users and crawlers, and not all bots can run JavaScript', and 'Once Google's resources allow, a headless Chromium renders the page and executes the JavaScript.' Requirements are content in the DOM and crawlable <a href> links, not a particular stack.
- **[Designing Agent-Ready Websites for AI Web Agents](https://arxiv.org/abs/2607.12056)** — arXiv (study, URL verified 2026-08-21)
  - Structures agent readiness as 'agent interpretability, agent executability, and agent decision reliability', supported by 'machine readability, semantic clarity, agent actionability, and contextual decision-reliability signals', with improvements in 'structural clarity, action cues, evidence signals, and temporal validity indicators'. Framework identity, framework detection and client-side rendering are absent from the framework; it also notes GEO metrics do not fully assess agent-readiness.
- **[OpenAI crawlers and user agents](https://developers.openai.com/api/docs/bots)** — OpenAI (vendor-doc, URL verified 2026-08-21)
  - No statement about JavaScript execution, rendering, or frameworks for GPTBot, OAI-SearchBot or ChatGPT-User. Documentation is limited to user agents, IP ranges, robots.txt and use cases — so framework identity cannot be mapped to any disclosed consumer capability.
- **[Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)** — Anthropic (vendor-doc, URL verified 2026-08-21)
  - Provides no technical specification about rendering capabilities or content discovery for ClaudeBot, Claude-User or Claude-SearchBot; scope is robots.txt honoring and Crawl-delay support.
- **[agent-lighthouse server-rendered.ts (audit 8.13)](https://github.com/ForkPoint/agent-lighthouse/blob/main/packages/core/src/audits/technical-readiness/server-rendered.ts)** — ForkPoint / agent-lighthouse (repo, URL verified 2026-08-21)
  - Sibling audit at critical priority that directly measures the delivered HTML ('Homepage <main> has > 50 words or > 200 characters of text content') and fails client-side-only pages. This is the ground-truth measurement that framework detection merely proxies, making 8.21 redundant. Read from the local working copy at /Users/kirov/dev/forkpoint/agent-lighthouse/packages/core/src/audits/technical-readiness/server-rendered.ts; the GitHub URL was not fetched.

## v1 dossier — what it checked and the 2026-08-20 code review

Merged in on 2026-08-22 from `docs/evidence/audits/technical-readiness/framework-detection.md`, so a removed audit has exactly one dossier and it lives here.

### What it checks

AI agents can optimize their interaction strategy if they know the underlying technology stack (e.g., React, Next.js, Vue). This also helps identify potential client-side rendering issues.

### Code review findings (2026-08-20, 11-agent pass)

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

### Evidence

#### Signal: SSR vs CSR — do GPTBot/ClaudeBot/PerplexityBot execute JavaScript? — grade B (technical-infra)

**Mechanism:** Content that exists in the DOM only after client-side JavaScript execution is invisible to the major non-rendering AI crawlers, which parse the raw HTML response only. FALSIFIABLE FORM: a page whose main content is injected client-side is fetched with HTTP 200 by GPTBot/ClaudeBot/PerplexityBot but the injected text never appears in those systems' answers or indexes, whereas an SSR/SSG equivalent does.

**Evidence:** This is the best-evidenced signal in the domain. Joint Vercel + MERJ instrumentation (Edge Middleware plus MERJ's Web Rendering Monitor, on nextjs.org with supplemental data from monogram.io and basement.io) found zero evidence of JavaScript execution across the major AI crawlers: OAI-SearchBot, ChatGPT-User, GPTBot, ClaudeBot, PerplexityBot, Meta's external agent and ByteDance's crawler. The crawlers still DOWNLOAD JS bundles as text — ChatGPT 11.50%, Claude 23.84% of requests — which is exactly the artefact you expect from a text extractor that fetches subresources without a render tree. Corroborated at scale by the same dataset's traffic figures (GPTBot 569M req/month, Claude 370M on Vercel's network).

**Counter-evidence:** The claim must be stated with named exceptions, or it is false. (a) Gemini renders JavaScript because it inherits Googlebot's evergreen-Chromium rendering infrastructure — Google documents Googlebot tracking 'the latest Chromium release version'. (b) Apple states directly that 'Applebot may render the content of your website within a browser' and that blocking JS/CSS/XHR in robots.txt breaks that rendering. (c) The entire browser-agent class — ChatGPT Atlas, Perplexity Comet, Gemini in Chrome, Claude in Chrome — is Chromium and executes JS exactly like a human visitor. (d) No bot vendor (OpenAI, Anthropic, Perplexity) has ever published a statement confirming or denying JS execution; the OpenAI bots page is silent on rendering. So this rests on third-party measurement, which is why it is B and not A. Finally, the finding is a snapshot: crawler capabilities can change without announcement, so the dossier should carry the measurement date.
**Consumers:** GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot, Meta external agent, Bytespider · **Recommended tier:** scored

**Sources:** [The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler) · [About Applebot](https://support.apple.com/en-us/119829) · [Google crawlers and fetchers (user agents) — Common crawlers](https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers) · [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) · [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) · [Perplexity Crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **sunset** (graceful sunset per evidence-policy deprecation process; condensed rationale kept in not-a-factor.md).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.

- 2026-08-22 — v1 dossier merged in from `docs/evidence/audits/technical-readiness/framework-detection.md`; that copy removed (one dossier per removed audit, under `sunset/`).
