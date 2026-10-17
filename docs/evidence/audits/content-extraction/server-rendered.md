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

## Evidence

### Signal: SSR vs CSR — do GPTBot/ClaudeBot/PerplexityBot execute JavaScript? — grade B (technical-infra)

**Mechanism:** Content that exists in the DOM only after client-side JavaScript execution is invisible to the major non-rendering AI crawlers, which parse the raw HTML response only. Falsifiable form: a page whose main content is injected client-side is fetched with HTTP 200 by GPTBot/ClaudeBot/PerplexityBot but the injected text never appears in those systems' answers or indexes, whereas an SSR/SSG equivalent does.

**Grade: B** — The best-evidenced signal in this domain, and measured rather than claimed: joint Vercel and MERJ instrumentation on nextjs.org, with supplemental data from two other sites, found zero JavaScript execution across OAI-SearchBot, ChatGPT-User, GPTBot, ClaudeBot and PerplexityBot. Independent instrumentation of named tokens is strong evidence; what keeps it off A is that no vendor states the limitation itself, so the finding rests on observation of behaviour that could change silently. The exceptions are named in the audit rather than smoothed over: Gemini inherits Googlebot's evergreen-Chromium rendering, and Apple documents that "Applebot may render the content of your website within a browser".

**Evidence:** This is the best-evidenced signal in the domain. Vercel and MERJ ran joint instrumentation: Edge Middleware plus MERJ's Web Rendering Monitor, on nextjs.org, with supplemental data from monogram.io and basement.io. It found zero evidence of JavaScript execution across the major AI crawlers: OAI-SearchBot, ChatGPT-User, GPTBot, ClaudeBot, PerplexityBot, Meta's external agent and ByteDance's crawler. The crawlers still DOWNLOAD JS bundles as text — ChatGPT 11.50%, Claude 23.84% of requests — which is exactly the artefact you expect from a text extractor that fetches subresources without a render tree. Corroborated at scale by the same dataset's traffic figures (GPTBot 569M req/month, Claude 370M on Vercel's network).

**Counter-evidence:** The claim must be stated with named exceptions, or it is false. (a) Gemini renders JavaScript because it inherits Googlebot's evergreen-Chromium rendering infrastructure — Google documents Googlebot tracking 'the latest Chromium release version'. (b) Apple states directly that 'Applebot may render the content of your website within a browser' and that blocking JS/CSS/XHR in robots.txt breaks that rendering. (c) The entire browser-agent class — ChatGPT Atlas, Perplexity Comet, Gemini in Chrome, Claude in Chrome — is Chromium and executes JS exactly like a human visitor. (d) No bot vendor (OpenAI, Anthropic, Perplexity) has ever published a statement confirming or denying JS execution; the OpenAI bots page is silent on rendering. So this rests on third-party measurement, which is why it is B and not A. Finally, the finding is a snapshot: crawler capabilities can change without announcement, so the dossier should carry the measurement date.

## Implementation deviations

- The text is the served `<body>` minus `script`, `style`, `noscript` and `template` (`getRenderedText`), not the main content region. A shell that ships only chrome is what the audit exists to catch.
- The per-page rule is the shared `pageRendersText`: more than 50 words or more than 200 characters.
- Every fetched page is judged. Empty pages are listed in `details.emptyPages`.
- A scan with no fetched page returns `notApplicable`.

## Deferred

- Turning the `or` into an `and`. The character branch is the only path for non-space-delimited scripts, so CJK pages would fail.
- Scoring the content region rather than the served body. A template whose chrome alone clears 200 characters passes.
- Raising the threshold. The right number has not been measured.

## Browser snapshot boundary

This audit is not eligible for snapshot analysis. It reads actual HTTP-derived content and evidence. Readable browser-rendered HTML cannot make this audit pass, satisfy its HTTP access requirements, or change the crawler score. The separate browser assessment can report supported DOM observations even when this audit fails or server access is blocked. See [Browser-rendered snapshot assessment](../../../architecture/browser-snapshots.md).

## DOM analysis limits

The shared page parser bounds DOM depth while it builds the tree, then total ancestor work before extraction and classification. The limits are in `DOM_WORK_LIMITS`. An HTTP response can arrive successfully while its DOM exceeds these analysis limits. Such a page does not enter this audit. If no HTTP page remains available for analysis, the audit returns `notApplicable` with the analysis-limit reason. It does not report a JavaScript shell, a blocked request, or a missing HTTP response. The report keeps the actual HTTP status in the page attempt and keeps other usable pages.
