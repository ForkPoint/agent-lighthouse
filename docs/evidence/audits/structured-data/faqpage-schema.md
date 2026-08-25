---
audit: structured-data/faqpage-schema
category: structured-data
source_file: packages/core/src/audits/structured-data/faqpage-schema.ts
slug: faqpage-schema
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - google-faqpage-structured-data
  - google-search-gallery
  - webalmanac-2024-structured-data
  - microsoft-ads-ai-search-optimization
  - google-ai-features-trust
  - searchviu-schema-ai-fetch-test
  - ahrefs-schema-ai-citations
---

# faqpage-schema (`3.7`)

> structured-data · source `faqpage-schema.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

AI answer engines like Perplexity and Google SGE extract FAQ-structured content with higher confidence for direct answers. FAQPage schema makes your Q&A content machine-readable, giving it priority in AI-generated responses over unstructured text.

## Code review findings (2026-08-20, 11-agent pass)

The trigger is `heading.endsWith('?')`, which both over-fires (any CTA headline phrased as a question forces a hard fail) and under-fires (non-Latin question marks never match, silently exempting whole locales). Combined with a warn-instead-of-na precondition branch and a Google rich-result that was withdrawn from almost all sites in 2023, this audit produces frequent wrong guidance.

**Required fix:** Match `/[?？؟;]\s*$/` for the trigger, require at least 3 question headings each followed by ≥1 block of answer text, and exclude headings inside `nav`, `header`, `footer`, and `[role="dialog"]`. Return `notApplicable` when the precondition is absent. Verify the detected FAQPage actually has a non-empty `mainEntity` of Question/acceptedAnswer pairs. Rewrite the description to drop the 'Google SGE' claim and state the answer-engine benefit as expected rather than established.

**False-positive risks:**
- `extractHeadings(page).some((h) => h.endsWith('?'))` — a single rhetorical marketing heading ('Ready to get started?', 'Why choose us?', 'Questions?') triggers the requirement, and the audit then returns a hard `fail` at medium priority telling the site to add FAQPage schema to a page that has no Q&A content at all. Question-phrased section headings are ubiquitous on landing pages.
- English/Latin-punctuation only. Japanese and Chinese pages use the full-width '？', Arabic/Persian use '؟', and Greek uses ';'. None end with ASCII '?', so non-Latin sites never trigger and fall into the 'no question headings' branch permanently — an entire class of sites silently exempted while their English competitors are failed.
- The precondition-absent branch returns `this.warn(...)` (score 0.5) rather than `notApplicable`, so a site with no FAQ content is docked half a point for content it never claimed to have.
- No minimum count and no verification that answer text actually follows the heading — one question-shaped `<h6>` in a footer is enough to demand schema.
- Uses raw `page.$('h1..h6')` with no exclusion of nav/footer/cookie-banner regions, so template chrome ('Need help?') triggers the requirement on every page of the site simultaneously, turning a single template string into a site-wide fail.

**Test gaps:**
- No test for a marketing page with one rhetorical question heading and no Q&A content (should not hard-fail)
- No test with '？' / '؟' / non-English question headings
- No test where the question heading is in nav/footer template chrome
- No test asserting a minimum number of Q&A pairs before requiring schema
- No test asserting the no-questions branch should be `na` rather than `warn`
- No test that the FAQPage's `mainEntity` actually contains Question/acceptedAnswer pairs

**Overlaps with:** _none_

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Evidence (2026-08-21)

**Mechanism claim:** Google Search parses FAQPage markup and renders its Question/acceptedAnswer pairs as an expandable FAQ rich result beneath the page's search listing.

**Grade: C** — the only documented consumer path for this signal has been withdrawn: Google first restricted the FAQ rich result to authoritative government and health sites, then retired the feature and dropped it from the structured data gallery. No other vendor documents a named consumer, so what remains is a widely-published community convention with a plausible but unproven mechanism.

**Evidence:**
- Google's own FAQPage documentation records the restriction: the FAQ rich result "is only shown for well-known, authoritative government and health websites". It then records the removal of the feature and its documentation. The changelog states that "The FAQ rich result feature is no longer shown in Google Search results", under a deprecation notice effective 7 May 2026 — https://developers.google.com/search/docs/appearance/structured-data/faqpage (verified 2026-08-21)
- FAQ is absent from Google's current structured data gallery. Of the features listed there, Breadcrumb, Article, Local business, Review snippet and Organization all remain; FAQ does not — https://developers.google.com/search/docs/appearance/structured-data/search-gallery (verified 2026-08-21)
- The convention nevertheless persists and is still growing: FAQPage rose from 0.2% of desktop pages in 2022 to 0.6% in 2024 — https://almanac.httparchive.org/en/2024/structured-data (verified 2026-08-21)
- The one remaining vendor gesture toward FAQ markup is a Microsoft Advertising marketing post: "Schema can label your content as a product, review, FAQ, or event, turning plain text into structured data that machines can interpret with confidence". That is a secondary source, and it names no consuming system and no mechanism — https://about.ads.microsoft.com/en/blog/post/october-2025/optimizing-your-content-for-inclusion-in-ai-search-answers (verified 2026-08-21)

**Counter-evidence:** Nothing supports the audit description's specific claim that "AI answer engines like Perplexity and Google SGE extract FAQ-structured content with higher confidence for direct answers". Google states the opposite of the premise: "You don't need to create new machine readable files, AI text files, or markup to appear in these features. There's also no special schema.org structured data that you need to add" — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21). A controlled fetch test found ChatGPT (37.5% of values recovered), Claude (0%), Perplexity (12.5%) and Google AI Mode (25%) all failed to read data present only in JSON-LD — https://www.searchviu.com/en/schema-markup-and-ai-in-2025-what-chatgpt-claude-perplexity-gemini-really-see/ (verified 2026-08-21). A matched difference-in-differences study of 1,885 pages adding JSON-LD found AI Mode +2.4% and ChatGPT +2.2% (both noise) and AI Overviews −4.6% — https://ahrefs.com/blog/schema-ai-citations/ (verified 2026-08-21)
