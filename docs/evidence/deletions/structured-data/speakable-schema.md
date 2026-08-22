---
audit: structured-data/speakable-schema
category: structured-data
status: kept-rewrite
verdict: redeemable
evidence_grade: A
reviewed: 2026-08-21
---

# speakable-schema — redeemed — keep with rewrite

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **A**.

## Claimed mechanism (steelmanned)

Voice-first AI assistants need to know which DOM regions of a page are worth reading aloud. If a publisher marks a headline and summary with schema.org `speakable` / `SpeakableSpecification` + `cssSelector`, a named voice agent will select exactly those nodes for TTS instead of guessing at boilerplate/nav. For the audit to matter, at least one shipping assistant must document reading `speakable` from crawled pages.

## What we searched

The session's WebSearch quota was already exhausted, so I went directly to canonical vendor URLs with WebFetch and curl. I fetched Google Search Central's speakable page and confirmed at the raw-HTML level that it is live today (HTTP 200 at its own URL, <title> 'Speakable (BETA) Schema Markup', body text 'The Google Assistant uses...to read aloud on Google Assistant-enabled devices using TTS'). I cross-checked Google's structured-data feature gallery, which still lists Speakable among its supported features, while HowTo and sitelinks searchbox are absent. I then hunted for counter-evidence: Google's documentation-updates changelog (no speakable removal entry), the Aug 2025 Gemini for Home announcement (Assistant being replaced on speakers/displays), Apple's Applebot page (which documents exactly one schema.org property), and Microsoft's NLWeb repo (cloned and grepped: zero references to speakable). I also pulled schema.org's own adoption figure for the property.

## Best evidence found for the audit

Google Search Central's Speakable doc is live and current (HTTP 200, no deprecation notice) and names its consumer explicitly: 'The Google Assistant uses [speakable] ... to read aloud on Google Assistant-enabled devices using TTS.' Independently, Speakable is still one of the features listed in Google's current structured-data gallery: 'Allow search engines and other applications to identify news content to read aloud on Google Assistant-enabled devices.' schema.org reports 100K-1M domains using the property (Google web index aggregation, July 2026). This is a named vendor + named agent + live doc — the only one of the four audits with that.

## Counter-evidence

Real, but scoping-level rather than kill-level. (1) The feature has been in BETA since 2018 and the doc still carries 'This feature is in beta and subject to change'; Google's stated launch condition ('We hope to launch in other countries and languages as soon as sufficient number of publishers have implemented speakable') has not been met in 8 years. (2) It is hard-limited: 'The speakable property works for users in the U.S. that have Google Home devices set to English, and publishers that publish content in English,' and is news-content-only. (3) The sole documented consumer is being retired: Google announced on 2025-08-20 that 'Over time, Gemini for Home will replace Google Assistant on existing speakers and displays' (https://blog.google/products/google-nest/gemini-for-home/), with no successor statement about speakable. (4) The audit's description names Alexa and Siri as consumers — this is fabricated. Apple's Applebot page (https://support.apple.com/en-us/119829) documents support for exactly one schema.org property, `isAccessibleForFree`, and no speakable; Amazon publishes no speakable documentation. (5) Microsoft's NLWeb repo (cloned from github.com/nlweb-ai/NLWeb) contains zero occurrences of 'speakable' in any .py/.md/.json/.ts file.

## Verdict

**redeemed — keep with rewrite** (grade A)

Grade A: a live vendor doc names a specific agent (Google Assistant) that reads the signal, and the feature is still listed in Google's current supported-features gallery, so the rubric mandates 'redeemable'. But it must be redeemed in narrowed form, not as-is: (a) applicability should be restricted to news/article publishers (the audit currently runs site-wide with no page-type gate and defaults to fail for every non-news site), and (b) the description's claim that Alexa and Siri consume speakable must be deleted — it is unsupported by any vendor doc and directly contradicted by Applebot's documentation, which lists isAccessibleForFree as its only schema.org property. Flag the Gemini-for-Home transition as a re-check trigger.

## Sources

- **[Speakable (Article, WebPage) structured data (BETA)](https://developers.google.com/search/docs/appearance/structured-data/speakable)** — Google Search Central (vendor-doc, URL verified 2026-08-21)
  - Live (HTTP 200 at its own URL, no redirect, no deprecation notice). Title tag reads 'Speakable (BETA) Schema Markup'. Body: 'The Google Assistant uses [speakable] ... to read aloud on Google Assistant-enabled devices using TTS.' Beta aside present. Limited to U.S. English Google Home users and English-language news publishers.
- **[Structured data markup that Google Search supports](https://developers.google.com/search/docs/appearance/structured-data/search-gallery)** — Google Search Central (vendor-doc, URL verified 2026-08-21)
  - Speakable is still listed among supported features: 'Allow search engines and other applications to identify news content to read aloud on Google Assistant-enabled devices.' HowTo and sitelinks searchbox / SearchAction are NOT in the list.
- **[schema.org: speakable](https://schema.org/speakable)** — schema.org (spec, URL verified 2026-08-21)
  - Property is active (not pending, not deprecated). Usage stat shown: 100K - 1M domains, based on monthly aggregations from Google's web index, July 2026.
- **[Gemini for Home](https://blog.google/products/google-nest/gemini-for-home/)** — Google (The Keyword) (announcement, URL verified 2026-08-21)
  - Dated 2025-08-20. 'Over time, Gemini for Home will replace Google Assistant on existing speakers and displays, with free and paid versions.' The named consumer of speakable is on a retirement path.
- **[About Applebot](https://support.apple.com/en-us/119829)** — Apple (vendor-doc, URL verified 2026-08-21)
  - Applebot powers Spotlight, Siri, Safari search and Apple Intelligence. The ONLY schema.org property Apple documents supporting is isAccessibleForFree ('Applebot supports the schema.org isAccessibleForFree property'). No speakable, no Actions, no HowTo. Directly refutes the audit's 'Siri uses speakable' claim.
- **[NLWeb — natural language interfaces for websites (schema.org + MCP)](https://github.com/nlweb-ai/NLWeb)** — Microsoft / nlweb-ai (repo, URL verified 2026-08-21)
  - Cloned at depth 1 and grepped. 'speakable': 0 files. 'HowTo': 0 files. 'potentialAction': 0 files. 'OrderAction': 0 files. 'ReserveAction': 0 files. By contrast 'Recipe' appears in 33 files. The leading schema.org-driven agent framework ingests item/entity types, not these properties.

## Review history

- 2026-08-22 — required rework executed (Plan 4, Task 12); both required changes landed — applicability restricted to news/article publishers (`applicablePageTypes: ['content']` plus a runtime article-page guard, `notApplicable` when the crawl has none) and the fabricated Alexa/Siri claim deleted from every user-facing string. The Gemini-for-Home re-check trigger is stamped in the source header and the audit dossier. `TODO(redeem)` marker removed from the source file.

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **kept-rewrite** (kept, rewrite required per dossier).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.
