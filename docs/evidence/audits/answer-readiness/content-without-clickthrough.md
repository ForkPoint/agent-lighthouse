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

- Teasers are matched in the text of the largest `<main>`, or of the body when no `<main>` holds text (`getMainContentText`).
- The low-content warning skips the homepage and XML pages. JS-driven homepages often serve little text.
- A clean result returns `notApplicable` when the scan read no page text (`scanReadPageText`). The low-content branch skips the homepage, which is often the only page on a shell scan.

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
