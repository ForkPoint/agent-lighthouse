---
audit: structured-data/speakable-schema
audit_id: "3.9"
category: structured-data
source_file: packages/core/src/audits/structured-data/speakable-schema.ts
slug: speakable-schema
review_verdict: delete
severity: high
evidence_grade: A
disposition: "kept — rewrite required (approved 2026-08-21)"
reviewed: 2026-08-21
---

# speakable-schema (`3.9`)

> structured-data · source `speakable-schema.ts` · review verdict **delete** · evidence grade **A** · disposition: **kept — rewrite required (approved 2026-08-21)**

## What it checks

Voice-based AI agents (Google Assistant, Alexa, Siri) use the speakable property to identify which parts of your page to read aloud. Without it, voice agents must guess which content to vocalize, often choosing poorly. Add cssSelector references to your most important content sections.

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

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/structured-data/speakable-schema.md](../../deletions/structured-data/speakable-schema.md). Outcome: **redeemable**, grade A.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
