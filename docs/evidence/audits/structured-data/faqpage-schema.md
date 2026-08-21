---
audit: structured-data/faqpage-schema
audit_id: "3.7"
category: structured-data
source_file: packages/core/src/audits/structured-data/faqpage-schema.ts
slug: faqpage-schema
review_verdict: fix
severity: high
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# faqpage-schema (`3.7`)

> structured-data · source `faqpage-schema.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

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
