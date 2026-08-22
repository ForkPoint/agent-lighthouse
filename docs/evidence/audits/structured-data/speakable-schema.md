---
audit: structured-data/speakable-schema
audit_id: "3.9"
category: structured-data
source_file: packages/core/src/audits/structured-data/speakable-schema.ts
slug: speakable-schema
review_verdict: delete
severity: high
evidence_grade: A
disposition: "kept — rewritten to a news/article-gated check 2026-08-22 (Plan 4, Task 12)"
reviewed: 2026-08-22
---

# speakable-schema (`3.9`)

> structured-data · source `speakable-schema.ts` · evidence grade **A** · tier **scored** (weight 1.0) · rewritten from a site-wide binary check to a news/article-gated coverage check — see below

## What it checks

Google Assistant uses the speakable property to pick which sentences of a news article it reads aloud on Assistant-enabled devices. Without it, the assistant has to guess, and often vocalizes navigation or boilerplate instead of your headline and summary. Mark the headline and summary with cssSelector on your Article or WebPage node.

_(The pre-rewrite description named Alexa and Siri as consumers. That claim was fabricated and is quoted, with its refutation, in the rewrite section below.)_

## Code review findings (2026-08-20, 11-agent pass)

Checks a schema.org property whose only ever production consumer — Google Assistant news readouts, limited to US English news publishers — has been retired, and whose impact text names two consumers (Alexa, Siri) that never read schema.org speakable at all. It is `binary` with no `notApplicable` path, so essentially every site takes a hard 0, and the implementation additionally rejects the valid single-string `cssSelector` form.

**Required fix:** Delete the audit and remove it from the structured-data index. If any voice-related signal is wanted, replace it with something with a live consumer (e.g. a clean `<main>`/heading outline check in semantic-html), not schema.org speakable.

**False-positive risks:**
- `return sp && Array.isArray(sp['cssSelector'])` requires an ARRAY. schema.org permits `cssSelector` as a single value, and it permits `xpath` as the alternative selector property entirely. A site with correct `"speakable":{"@type":"SpeakableSpecification","cssSelector":".article-body"}` or with `"xpath"` fails. The test file explicitly asserts the string form is a fail, codifying the bug as intended behaviour.
- No `notApplicable` branch and `scoreDisplayMode: 'binary'` with weight 1.0 means ~100% of real sites take score 0 on this check, deflating the whole structured-data category by roughly 5 points for a signal with no consumer.
- Does not check that `speakable` is attached to an Article/WebPage (the only types where it is defined), so a speakable on an arbitrary node passes.
- The guidance text tells users that 'Google Assistant, Alexa, Siri use the speakable property' — Alexa and Siri have never had any schema.org speakable support. This is fabricated impact copy shipped to customers.

**Test gaps:**
- Tests assert the WRONG contract: 'fails when speakable cssSelector is not an array' encodes a false negative as expected behaviour
- No test for the `xpath` alternative
- No test that speakable is attached to a valid host type
- No coverage of what a user is supposed to gain from passing

**Overlaps with:** _none_

## The news/article-gating rewrite (Plan 4, Task 12, 2026-08-22)

The required rework from the [redemption dossier](../../deletions/structured-data/speakable-schema.md) is executed, together with the false-positive fixes the code review attached to the same audit. The mechanism the grade rests on is untouched — Google Search Central's live speakable doc names Google Assistant as the agent that reads the marked sections aloud with TTS — but the audit's applicability, its detection rules and its impact copy were all wrong.

**Old pass condition:** any JSON-LD node anywhere in the crawl, of any type, carries `speakable` whose `cssSelector` is an **array**. Anything else failed, at `binary`, weight 1.0 — so a plumber's site, a SaaS landing page and a store all took a hard 0 on a news-only signal.

**New pass condition:** every scanned news/article page carries a `SpeakableSpecification` with a `cssSelector` **or** `xpath`, on a node whose type defines the property. Partial coverage warns, no coverage fails, and a scan with no news/article page is `notApplicable`.

### (a) Applicability restricted to news/article publishers

Two layers, matching the `article-schema` precedent in the same category:

- **`applicablePageTypes: ['content']`.** `planAudits()` only executes an audit when a scanned page carries one of its declared types, so a crawl of a pure storefront (homepage + category + product) never runs this check — it is recorded as a page-type `na` stub instead of a zero.
- **Runtime guard.** Among the pages that were scanned, only article pages are assessed: `pageType === 'content'`, or a page directly carrying `Article` / `NewsArticle` / `BlogPosting` markup. The second clause is what keeps a news homepage in scope when it carries Article markup of its own; with no such page the audit returns `na` with "No news or article page was scanned; speakable applies to news content only."

Google's scope statement — the feature "works for users in the U.S. that have Google Home devices set to English, and publishers that publish content in English", news content only — is now reflected in the guidance rather than silently applied to every site as a failure.

### (b) The Alexa/Siri claim deleted

The shipped description and impact text used to read: *"Voice-based AI agents (Google Assistant, Alexa, Siri) use the speakable property…"*. Two-thirds of that list was fabricated. Apple's [About Applebot](https://support.apple.com/en-us/119829) documents exactly one schema.org property — `isAccessibleForFree` — and no speakable; Amazon publishes no speakable documentation at all. Both names are gone from `description`, `guidance.impact`, `guidance.fix`, the `code` sample and the failure-branch copy; only Google Assistant, the one documented consumer, is named. A regression test asserts the strings `alexa` and `siri` appear nowhere in the audit's meta and that `Google Assistant` does. `docsUrl` moves from `schema.org/speakable` to the Google Search Central doc that carries the consumer statement and the beta/scope caveats, and the misleading `accessibility` tag (speakable is not an assistive-technology signal) is replaced with `news`.

### Detection fixes from the code review

- **`cssSelector` may be a single string.** `Array.isArray(sp['cssSelector'])` rejected the valid `"cssSelector": ".article-body"` form — a correct implementation scored 0. Both the single value and the array are accepted now.
- **`xpath` is accepted.** schema.org's `SpeakableSpecification` offers `xpath` as the alternative selector property; the audit previously ignored it entirely.
- **Empty selectors do not count.** A blank string, an empty array, or a `SpeakableSpecification` with no selector at all is markup that points nowhere, and fails.
- **The host type is checked.** `speakable` is defined on `Article` and `WebPage` only, so it is honoured on those and their subtypes (matched by `Article` / `Page` / `Posting` suffix, which covers `NewsArticle`, `ReportageNewsArticle`, `BlogPosting`, `ItemPage`, `CollectionPage`, … without pinning a list schema.org keeps extending). A `speakable` hung off an `Organization` node no longer passes the audit.
- **Coverage is per page, not per schema.** The message reads "N of M article page(s)", so one marked-up article in a 40-page news crawl warns instead of passing the whole site.

### Grade decision: stays **A**, tier `scored`, weight 1.0

Source: the [redemption dossier's verdict](../../deletions/structured-data/speakable-schema.md) — "redeemed — keep with rewrite (grade A)" — and the [REWORK-TODO entry](../../../../packages/core/src/audits/REWORK-TODO.md) carrying it. Neither asks for a tier change; the required changes are to applicability and copy. Per the §4 weight law `weightForGrade('A', 'scored') = 1.0`. `scoreDisplayMode` moves `binary` → `ternary` to carry the new partial-coverage verdict (weight is nonzero, so `informative` would be wrong), and `defaultPriority` stays `low` — the feature is beta, US-English-only and news-only, which is upside rather than a deficiency anywhere else.

### Re-check trigger

Google announced on 2025-08-20 that "Over time, Gemini for Home will replace Google Assistant on existing speakers and displays", with no successor statement about speakable. If that transition completes and no Gemini-era doc carries the signal forward, the grade-A consumer is gone and this audit must be re-graded (candidate: `informative`) or sunset. The trigger is also stamped in the source file header.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass, which is why its tier initially fell to the taxonomy default. The 2026-08-21 adversarial pass below supplied the missing evidence — a live vendor doc naming Google Assistant as the consumer — and the grade-A assignment supersedes that default._

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/structured-data/speakable-schema.md](../../deletions/structured-data/speakable-schema.md). Outcome: **redeemable**, grade A.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
- 2026-08-22 — required rework executed (Plan 4, Task 12): page-type gate to news/article publishers, Alexa/Siri claim deleted, single-string `cssSelector` and `xpath` accepted, host type enforced, coverage judged per page, `binary` → `ternary`. Grade A, tier `scored`, weight 1.0 unchanged. `TODO(redeem)` marker removed from the source file.
