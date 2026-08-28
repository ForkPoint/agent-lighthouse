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

AI agents use the lang attribute to select the correct language model and tokenizer when processing your content. Without it, agents may misinterpret content language, leading to poor translations or incorrect answers in multilingual AI systems.

## Code review findings (2026-08-20, 11-agent pass)

Cheap and worth keeping, but the check is presence-only: `if (lang.trim().length > 0)` accepts any string at all. An invalid or templated lang value is arguably worse than a missing one — it actively misinforms consumers — and this audit awards it a full pass. The description's claim that agents 'select the correct tokenizer' from this attribute is overstated but harmless.

**Required fix:** 1) Validate against BCP 47 rather than emptiness: reject `lang="english"`, `lang="en_US"` (underscore is invalid; must be `en-US`), `lang="{{ locale }}"`, `lang="undefined"`, and bare region codes. A minimal regex `^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$` plus a check against a known primary-subtag list catches nearly all real errors. 2) Warn (not pass) when the declared language visibly conflicts with the content — e.g. `lang="en"` on a page whose text is majority CJK — since a wrong lang is the case that actually hurts. 3) Iterate all `ctx.pages` and flag inconsistency across pages of one site. 4) Fall back to `xml:lang` and `<meta http-equiv="content-language">` before failing.

**False-positive risks:**
- Invalid values pass: `const lang = $?.('html').attr('lang') ?? ''; if (lang.trim().length > 0)` — `lang="english"`, `lang="en_US"`, `lang="EN-us "`, `lang="{{page.lang}}"` and `lang="undefined"` (all seen in the wild from templating bugs) score 1.0 while telling consumers something false.
- Wrong-language declarations pass: a German site that copied a starter template and left `lang="en"` is reported as correct — the exact scenario the audit's own rationale says causes 'poor translations'.
- Only `ctx.pages[0]` is checked; a multilingual site with per-locale subpaths where only the landing page sets lang passes.
- `xml:lang`-only documents (XHTML served as text/html) and `<meta http-equiv="content-language">` fallbacks are not consulted → false fail.
- SPA shells that set `document.documentElement.lang` in JS have no lang in the fetched HTML → false fail on a site that renders correctly for any JS-executing agent.
- WAF interstitial pages typically omit lang → false fail bundled with the other 17.

**Test gaps:**
- No invalid-value tests at all (`en_US`, `english`, template token, whitespace-only).
- No `xml:lang`-only or `http-equiv="content-language"` case.
- No multi-page/multilingual site case.
- No test for `lang=""` (explicitly empty, which is valid HTML meaning 'unknown').
- Only 3 tests.

**Overlaps with:** _none_

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Implementation deviations

- 2026-08-28 — the audit declines when the scan holds no response it can
  attribute to this site. It read the `<html lang>` of the first scanned page,
  and `ctx.pages`/`ctx.rootFiles` carry whatever answered 200 — on a parked
  domain a broker's page from another host, on a walled or throttled origin
  nothing at all. It now consults `scanReadTheSite()` and returns
  `notApplicable` carrying the gate's own reason.
  Verdicts that moved on the five nothing-obtained contract states: walled
  fail → na, throttled fail → na, redirected away pass → na, non-HTML homepage
  fail → na, HTTP 200 bot challenge pass → na. Found by
  `packages/core/src/tests/hostile-state-contract.test.ts`.
- 2026-08-28 — `requires` drops `rendered-body` and `sample-adequate` and is now
  `['origin-reachable', 'unblocked-fetches']`. The `lang` attribute is an
  attribute of `<html>`, served before any body renders, so whether a page
  rendered text has no bearing on whether it declared its language. Recorded as a
  gate exemption in `scripts/lib/requires-analysis.mjs`. The verdict itself
  does not move, but the gate is on for every scan, so a client-rendered scan
  is now scored on its `lang` attribute at weight 1.0 instead of being skipped.
  With `server-responsiveness`, this is what takes the `content-extraction`
  category from unscored to 73 on the shell contract state. Found by
  `packages/core/src/tests/hostile-state-contract.test.ts`.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Evidence (2026-08-21)

**Mechanism claim:** User agents read the `lang` attribute on `<html>` to programmatically determine the page's natural language. Screen readers select pronunciation rules from it, visual browsers select scripts and characters, and media players select captions. A page without it cannot have its language programmatically determined, and fails WCAG 2.2 SC 3.1.1.

**Grade: A** — ratified W3C Recommendation (WCAG 2.2, SC 3.1.1 Language of Page, Level A) plus WHATWG HTML, with named consumer classes whose behavior W3C documents explicitly.

**Evidence:**
- WCAG 2.2 SC 3.1.1 (Level A), W3C Recommendation of 12 December 2024: "The natural language of each web page can be programmatically determined." — https://www.w3.org/TR/WCAG22/ (verified 2026-08-21)
- Documented consumer behavior: "Screen readers can load the correct pronunciation rules", "Visual browsers can display characters and scripts correctly", "Media players can show captions correctly" — https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html (verified 2026-08-21)
- W3C i18n guidance names `<html lang>` as the required declaration mechanism: "you should always declare the language of the text in a page using a language attribute on the `html` tag" — https://www.w3.org/International/questions/qa-html-language-declarations (verified 2026-08-21)
- Same source rules out the fallback the audit does not currently consult: "You should never use a `meta` element with the `http-equiv` attribute set to `Content-Language` to indicate the language of a page" — https://www.w3.org/International/questions/qa-html-language-declarations (verified 2026-08-21)

**Counter-evidence:** Google Search explicitly ignores this attribute for language determination: "We don't use any code-level language information such as `lang` attributes, or the URL... Google uses the visible content of your page to determine its language" — https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites (verified 2026-08-21). No LLM vendor documents the audit's stated mechanism (selecting a "language model and tokenizer" from `lang`); OpenAI's crawler documentation mentions no HTML metadata — https://developers.openai.com/api/docs/bots (verified 2026-08-21). The grade rests on the accessibility/i18n consumer path, not on an AI-specific one; the audit's `description` and `guidance.impact` should be restated accordingly. Note also that the standard is satisfied by a *valid* BCP 47 tag, which the current presence-only check does not verify — an invalid or wrong `lang` still fails SC 3.1.1 while scoring 1.0 here.
