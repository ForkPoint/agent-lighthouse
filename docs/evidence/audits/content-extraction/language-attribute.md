---
audit: content-extraction/language-attribute
category: content-extraction
source_file: packages/core/src/audits/content-extraction/language-attribute.ts
slug: language-attribute
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - wcag-22
  - wcag-language-of-page
  - w3c-i18n-lang-declarations
  - google-multi-regional
  - s18
---

# language-attribute (`4.4`)

> meta-tags · source `language-attribute.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

Checks that every selected page has a non-empty `lang` attribute on `<html>`,
including pages that serve no body text. Screen readers use the declared language
to select pronunciation rules. This check measures presence; it does not validate
BCP 47 tags or compare the declared language with the page's text.

All selected pages with a non-empty declaration pass. Any missing or blank
declaration fails. An empty sample is not applicable. Different pages can declare
different languages; this check does not require a site-wide language value.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Implementation deviations

- Every sampled page is judged through `judgePages`. Missing and blank declarations count alike.
- `requires` is `[OriginReachable, UnblockedFetches]` only. `<html lang>` is served before any body renders, so a client-rendered page is still judged. The exemption is recorded in `scripts/lib/requires-analysis.ts`.

## Deferred

- BCP 47 validation.
- Agreement between the declared and the observed language.
- XML document handling. It needs its own parsing and evidence contract.
- A `meta http-equiv="Content-Language"` element is not a fallback for `<html lang>`, per the evidence below.

## Evidence (2026-08-21)

**Mechanism claim:** User agents read the `lang` attribute on `<html>` to programmatically determine the page's natural language. Screen readers select pronunciation rules from it, visual browsers select scripts and characters, and media players select captions. A page without it cannot have its language programmatically determined, and fails WCAG 2.2 SC 3.1.1.

**Grade: A** — ratified W3C Recommendation (WCAG 2.2, SC 3.1.1 Language of Page, Level A) plus WHATWG HTML, with named consumer classes whose behavior W3C documents explicitly.

**Evidence:**

- WCAG 2.2 SC 3.1.1 (Level A), W3C Recommendation of 12 December 2024: "The natural language of each web page can be programmatically determined." — https://www.w3.org/TR/WCAG22/ (verified 2026-08-21)
- Documented consumer behavior: "Screen readers can load the correct pronunciation rules", "Visual browsers can display characters and scripts correctly", "Media players can show captions correctly" — https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html (verified 2026-08-21)
- W3C i18n guidance names `<html lang>` as the required declaration mechanism: "you should always declare the language of the text in a page using a language attribute on the `html` tag" — https://www.w3.org/International/questions/qa-html-language-declarations (verified 2026-08-21)
- Same source rules out the fallback the audit does not currently consult: "You should never use a `meta` element with the `http-equiv` attribute set to `Content-Language` to indicate the language of a page" — https://www.w3.org/International/questions/qa-html-language-declarations (verified 2026-08-21)

**Counter-evidence:** Google Search explicitly ignores this attribute for language determination: "We don't use any code-level language information such as `lang` attributes, or the URL... Google uses the visible content of your page to determine its language" — https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites (verified 2026-08-21). No LLM vendor documents the audit's stated mechanism (selecting a "language model and tokenizer" from `lang`); OpenAI's crawler documentation mentions no HTML metadata — https://developers.openai.com/api/docs/bots (verified 2026-08-21). The grade rests on the accessibility/i18n consumer path, not on an AI-specific one; the audit's `description` and `guidance.impact` should be restated accordingly. Note also that the standard is satisfied by a _valid_ BCP 47 tag, which the current presence-only check does not verify — an invalid or wrong `lang` still fails SC 3.1.1 while scoring 1.0 here.
