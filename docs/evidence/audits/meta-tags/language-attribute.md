---
audit: meta-tags/language-attribute
audit_id: "4.4"
category: meta-tags
source_file: packages/core/src/audits/meta-tags/language-attribute.ts
slug: language-attribute
review_verdict: fix
severity: medium
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
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

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
