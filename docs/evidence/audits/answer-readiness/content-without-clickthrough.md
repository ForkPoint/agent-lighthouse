---
audit: answer-readiness/content-without-clickthrough
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/content-without-clickthrough.ts
slug: content-without-clickthrough
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - google-ai-optimization-mythbusting
  - google-ai-features-trust
  - vercel-rise-of-ai-crawler
  - s18
  - s15
---

# content-without-clickthrough (`9.9`)

> answer-engine · source `content-without-clickthrough.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

AI answer engines skip teaser content that gates answers behind sign-ups or downloads. Provide substantive answers directly on the page.

## Implementation deviations

- 2026-08-26 — the shared text helper this audit reads, `getMainContentText`, changed its selection. Among several `<main>` elements it now returns the one holding the most text rather than the first, it ignores a `<main>` inside a `<template>`, and it falls back to the whole `<body>` only when no `<main>` holds any text. Measured cause (scan evidence gate design, section 2.4): storefronts ship empty or fragmented `<main>` wrappers, and the first one is often a stub. Two consequences for this audit. A page whose real content sits in a later `<main>` is now measured on that content. A page whose every `<main>` is empty is now measured on its body text, page chrome included, where it previously measured as empty.
- 2026-08-26 — the audit carried a private copy of the old first-`<main>` word count, written when the shared helper had no empty-`<main>` fallback. That copy is removed; the audit reads the shared `getWordCount`, so its low-content warning and its teaser scan now measure the same text.
- 2026-08-28 — the audit declines when the scan holds no response it can
  attribute to this site. It read the teaser text of the first scanned page,
  and `ctx.pages`/`ctx.rootFiles` carry whatever answered 200 — on a parked
  domain a broker's page from another host, on a walled or throttled origin
  nothing at all. It now consults `scanReadTheSite()` and returns
  `notApplicable` carrying the gate's own reason.
  Verdicts that moved on the five nothing-obtained contract states: walled
  fail → na, throttled fail → na, redirected away pass → na, non-HTML homepage
  pass → na, HTTP 200 bot challenge pass → na. Found by
  `packages/core/src/tests/hostile-state-contract.test.ts`.
- 2026-08-28 — teasers are body copy, and the low-content warning deliberately
  skips the homepage, which on a JS-shell scan is often the only page sampled. A
  page with no text therefore reached the clean pass. That pass now returns
  `notApplicable` when `scanReadPageText()` is false; the teaser fail and the
  low-content warn are unchanged. Verdict moved on the shell contract state:
  pass → na. Found by
  `packages/core/src/tests/hostile-state-contract.test.ts`.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** Answer text that appears only after a sign-up, a form submission or a file download is absent from the HTML that AI crawlers fetch. An answer engine then has nothing to extract or cite from that page. A page whose fetched body contains only a teaser contributes no citable content.

**Grade: B** — the mechanism follows from documented crawler behavior and a documented eligibility rule, but no vendor doc or study measures gating (still less teaser-phrase density) against citation rate, and the detector's actual signal is an invented proxy.

**Evidence:**

- Google states the input set for its generative answers: "Google Search generative AI models use publicly accessible, crawlable content to learn patterns and provide relevant, grounded responses" — https://developers.google.com/search/docs/fundamentals/ai-optimization-guide (verified 2026-08-21)
- The snippet-eligible text is the ceiling on what AI surfaces can use: "To be eligible to be shown as a supporting link in AI Overviews or AI Mode, a page must be indexed and eligible to be shown in Google Search with a snippet". The same page names the levers: "To limit the information shown from your pages in Search, use `nosnippet`, `data-nosnippet`, `max-snippet`, or `noindex` controls". Google confirms those controls apply to AI features, because they are built into Search — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21)
- Crawler telemetry shows the gate is never opened. Across Vercel's network, "none of the major AI crawlers currently render JavaScript". ChatGPT and Claude crawlers "do _fetch_ JavaScript files (ChatGPT: 11.50%, Claude: 23.84% of requests), they don't _execute_ them". Any answer revealed only by a client-side unlock is therefore invisible to them — https://vercel.com/blog/the-rise-of-the-ai-crawler (verified 2026-08-21)
- OpenAI documents its crawlers as plain fetchers. OAI-SearchBot is there to "surface websites in search results in ChatGPT's search features", GPTBot for training-data crawling, and ChatGPT-User "for certain user actions in ChatGPT and Custom GPTs". No form-filling, authentication or download capability is described — https://developers.openai.com/api/docs/bots (verified 2026-08-21)

**Counter-evidence:** Gating does not by itself remove a page from the index. Google documents a supported paywalled-content path. Marking the gated section with structured data "helps Google differentiate paywalled content from the practice of cloaking, which violates spam policies". Publishers who want the paywalled sections crawled and indexed are advised to "make sure Googlebot and Googlebot-News if applicable, can access your page" (https://developers.google.com/search/docs/appearance/structured-data/paywalled-content). So a properly marked subscription page can be both gated to humans and fully citable — the mechanism holds for lead-gen teasers, not for gating in general. Separately, nothing in vendor documentation or the literature links teaser-phrase density to citation rate. The detector's threshold of two matching English phrases from a hand-written list, and its 50-word warn threshold, have no documented basis and no adoption evidence. Graded on their own, those specific rules are D. The grade attaches to the gating mechanism, not to this detector. All URLs verified 2026-08-21.
