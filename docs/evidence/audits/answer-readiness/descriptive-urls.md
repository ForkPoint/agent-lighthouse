---
audit: answer-readiness/descriptive-urls
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/descriptive-urls.ts
slug: descriptive-urls
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: informative
consumers:
  - "Google Search (documented as a crawlability/comprehension best practice, explicitly NOT claimed as a ranking factor)"
  - none-known for AI-citation selection
signals:
  - name: Descriptive URLs
    grade: C
    domain: geo-authority
sources:
  - google-url-structure
  - semrush-technical-seo-ai
  - google-ai-features-trust
  - anthropic-crawlers
  - geo-critical-survey-arxiv
---

# descriptive-urls (`10.15`)

> generative-engine · source `descriptive-urls.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

AI engines use URL text as a content signal. Descriptive slugs help agents understand page topics before fetching the content.

## Evidence

### Signal: Descriptive URLs — grade C (geo-authority)

**Mechanism:** URLs containing readable, hyphen-separated words describing the page's topic increase the likelihood of the page being retrieved and cited by AI answer engines, relative to opaque ID-based URLs.

**Evidence:** Google's URL structure doc gives clear, quotable guidance. First: 'When possible, use readable words rather than long ID numbers in your URLs.' Second: 'Use words in your audience's language in the URL (and, if applicable, transliterated words).' Third: 'We recommend using hyphens (-) instead of underscores (_) to separate words in your URLs.' Semrush analysed 5 million cited URLs across ChatGPT Search and Google AI Mode. Citation counts peak for 21–25 character slugs (~87K citations), with a secondary peak at 6–10 characters. Moderate slug lengths of 17–40 characters consistently outperform very short and very long URLs. Mechanistically a descriptive slug does carry topical tokens that a retriever can match and that a synthesiser can render as meaningful anchor text, so the convention is coherent and costless to follow.

**Counter-evidence:** Google's own doc frames descriptive URLs purely as crawlability and human/machine comprehension, and makes no ranking claim whatsoever — it says only that they help 'Google Search (and your users) better understand your site'. The Semrush slug data is a distribution over already-cited URLs, with no uncited control group. It therefore cannot separate a URL effect from the confound that well-edited sites both write good slugs and produce citable content. Semrush labels the whole study correlational. No AI vendor documents URL wording as an input to source selection — OpenAI's and Anthropic's publisher-facing docs are silent, and Anthropic's crawler doc contains no content-selection guidance at all. The GEO paper did not test URLs among its nine methods, and the 2026 critical survey does not list URL structure among replicated levers. Google's AI-features doc reiterates there are no special optimizations for AI surfaces. Plausible, conventional, cheap — and entirely unproven as a citation driver.

## Implementation deviations

- 2026-08-28 — the audit declines when the scan holds no response it can
  attribute to this site. It read the URL slugs of the scanned pages, and
  `ctx.pages`/`ctx.rootFiles` carry whatever answered 200 — on a parked domain
  a broker's page from another host, on a walled or throttled origin nothing
  at all. It now consults `scanReadTheSite()` and returns `notApplicable`
  carrying the gate's own reason.
  Verdicts that moved on the five nothing-obtained contract states: walled
  fail → na, throttled fail → na, redirected away pass → na, non-HTML homepage
  pass → na, HTTP 200 bot challenge pass → na. Found by
  `packages/core/src/tests/hostile-state-contract.test.ts`.
- 2026-08-28 — `requires` drops `rendered-body` and `sample-adequate` and is now
  `['origin-reachable', 'unblocked-fetches']`. The audit judges the URL strings
  of the pages the scan fetched, and a URL is readable whether or not the page
  behind it rendered text. Recorded as a gate exemption in
  `scripts/lib/requires-analysis.mjs`. The verdict itself does not move, and
  the audit carries weight 0 in the `informative` tier, so a shell scan gains a
  reported line and no score. The reservation worth recording is the sample: a
  shell yields fewer URLs to judge, because link discovery finds less. Found by
  `packages/core/src/tests/hostile-state-contract.test.ts`.
