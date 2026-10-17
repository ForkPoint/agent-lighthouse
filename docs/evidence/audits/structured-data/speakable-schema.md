---
audit: structured-data/speakable-schema
category: structured-data
source_file: packages/core/src/audits/structured-data/speakable-schema.ts
slug: speakable-schema
evidence_grade: B
disposition: "kept — rewritten to a news/article-gated check 2026-08-22 (Plan 4, Task 12)"
reviewed: 2026-08-22
signals:
  - name: "`speakable` selects the sentences an assistant reads aloud"
    grade: B
    domain: structured-data
sources:
  - applebot-doc
  - google-speakable-doc
  - schemaorg-speakable
---

# speakable-schema (`3.9`)

> structured-data · source `speakable-schema.ts` · evidence grade **B** · tier **scored** (weight 0.6) · news/article-gated coverage check

## What it checks

The v7 runner selects article-purpose pages for this check. A `general` declaration does not establish article purpose. Detection can use Open Graph article metadata or primary article prose without author, date, or Article schema fields. Schema-only evidence remains a hint. Detected matches remain informative; a precise `article` declaration uses the existing audit tier.

Google Assistant uses the speakable property to pick which sentences of a news article it reads aloud on Assistant-enabled devices. Without it, the assistant has to guess, and often vocalizes navigation or boilerplate instead of your headline and summary. Mark the headline and summary with cssSelector on your Article or WebPage node.

_(The pre-rewrite description named Alexa and Siri as consumers. That claim was fabricated and is quoted, with its refutation, in the rewrite section below.)_

## Evidence

### Signal: `speakable` selects the sentences an assistant reads aloud — grade B (structured-data)

**Mechanism:** Google Assistant answers a spoken news query by reading article text aloud with text-to-speech, and `speakable` names the sections it reads. An article without it has its excerpt chosen for it — often from navigation or boilerplate, rather than from the headline and summary.

**Grade: B** — Google names the consuming agent on a live page, which is documented consumer behaviour, but the same page calls the feature beta and limits it to one country, one language and one content type. A vendor feature its own vendor labels provisional is a grade-B mechanism, not a grade-A one.

**Evidence:**

- Google Search Central's speakable page, last updated 2025-12-10, names the consumer and the behaviour. "When users ask for news about a specific topic, the Google Assistant returns up to three articles from around the web and supports audio playback using TTS for sections in the article with speakable structured data" — https://developers.google.com/search/docs/appearance/structured-data/speakable (verified 2026-08-24)
- The property is defined by schema.org on `Article` and `WebPage`, with `cssSelector` and `xpath` as the two addressing forms, both valid as a single string or an array — https://schema.org/speakable (verified 2026-08-21)

**Counter-evidence:** The same Google page states "This feature is in beta and subject to change", and scopes it to "users in the U.S. that have Google Home devices set to English, and publishers that publish content in English", news content only. No other consumer exists: Apple's Applebot documentation names exactly one schema.org property, `isAccessibleForFree`, and no `speakable` (https://support.apple.com/en-us/119829, verified 2026-08-21); Amazon publishes no `speakable` documentation at all. The widely repeated claim that Alexa and Siri read `speakable` has no primary source, and a regression test now asserts that neither name appears in this audit's copy. The consumer is also on a stated migration path: Google announced on 2025-08-20 that "Over time, Gemini for Home will replace Google Assistant on existing speakers and displays", with no successor statement about `speakable`. If that transition completes without one, this audit loses its consumer entirely rather than one grade.

## Implementation deviations

- The audit runs on article pages only. A scan with none returns
  `notApplicable`.
- Every article page must carry a `SpeakableSpecification`. Partial coverage
  warns, no coverage fails.
- `cssSelector` and `xpath` both count, as a single string or an array. A
  blank string, an empty array, or a specification with no selector does not
  count.
- `speakable` counts only on a host type that defines it: a type name ending
  in `Article`, `Page` or `Posting`. A `speakable` on an `Organization` does not
  pass.
- Only Google Assistant is named as a consumer. A test asserts the audit copy
  never names Alexa or Siri.

## Deferred

- Re-check trigger: Google announced on 2025-08-20 that Gemini for Home will
  replace Google Assistant on speakers and displays. If that completes with no
  speakable successor statement, the audit loses its consumer. Re-grade it to
  informative or sunset it. The trigger is also in the source file header.
