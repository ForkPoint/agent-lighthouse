---
audit: structured-data/howto-schema
category: structured-data
status: informative
verdict: dead-but-informative-candidate
evidence_grade: C
reviewed: 2026-08-21
---

# howto-schema — dead as scored audit — informative candidate (weight 0)

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **C**.

## Claimed mechanism (steelmanned)

When a page contains sequential instructions, an LLM or answer engine that reads JSON-LD gets an unambiguous ordered `step[]` array instead of having to infer step boundaries and ordering from heading text and prose. If retrieval-augmented answer engines parse JSON-LD during ingestion, HowTo markup would reduce step-ordering errors and truncated instructions in generated answers — an ingestion-quality benefit that survives even after Google stopped rendering HowTo rich results.

## What we searched

WebSearch quota was exhausted, so I verified via direct canonical fetches. I pulled the full body of Google's 'Changes to HowTo and FAQ rich results' blog post via curl + HTML-to-text extraction (WebFetch kept returning the blog archive nav) and got the exact September 14, 2023 update text. I confirmed the deprecation structurally: https://developers.google.com/search/docs/appearance/structured-data/how-to now 301s to https://developers.google.com/search/updates#how-to-deprecation — Google literally named the anchor 'how-to-deprecation'. I checked the current Search feature gallery (HowTo absent), the Google Assistant 'Actions from web content' overview (lists FAQ, Media, News, Podcasts — no How-to guides; developers.google.com/assistant/content/howto returns 404), schema.org's HowTo page for vocabulary status and adoption, Microsoft's NLWeb repo (grep: 0 hits), Apple's Applebot doc, and arXiv for empirical evidence that structured data drives AI-answer citation. Bing's structured-data help page is a JS-only shell and could not be text-extracted, so Bing's current HowTo support is unverified rather than disproven.

## Best evidence found for the audit

Two things, neither naming HowTo. (1) The type is alive and widely deployed: schema.org/HowTo shows no deprecated/attic/pending marker and reports 100K-1M domains (Google web index, July 2026); the official vocabulary dump schemaorg-current-https.jsonld contains 12 occurrences of schema:HowTo. (2) Empirical, pillar-level: the GEO-16 study (arXiv 2509.10762) audited 1,702 citations across Brave Summary, Google AI Overviews and Perplexity and found that 'pillars related to Metadata and Freshness, Semantic HTML, and Structured Data showed the strongest associations with citation.' That supports 'emit JSON-LD' generally — it does not isolate HowTo, and no vendor anywhere names HowTo as a consumed signal.

## Counter-evidence

Strong and explicit. (1) Google deprecated the rich result: 'As of September 13, Google Search no longer shows How-to rich results on desktop, which means this result type is now deprecated' (blog post dated 2023-08-08, updated 2023-09-14). Same post: support was dropped from the Rich Results Test within 30 days and from the Search Console API within 180 days. (2) Google removed the documentation entirely: 'Removed the How-to structured data documentation, as this rich result is no longer shown in search results, on both desktop and mobile devices' (developers.google.com/search/updates, 2023-09-14), and the old doc URL now 301-redirects to the anchor #how-to-deprecation. (3) Google states unused markup is inert: 'Structured data that's not being used does not cause problems for Search, but also has no visible effects in Google Search.' (4) The voice/assistant path is gone too: developers.google.com/assistant/content/howto returns HTTP 404, and the surviving 'Actions from web content' overview lists only FAQs, Media, News and Podcasts. (5) Zero mentions in Microsoft's NLWeb codebase; Apple's Applebot documents only isAccessibleForFree; OpenAI's commerce spec excludes JSON-LD sources entirely.

## Verdict

**dead as scored audit — informative candidate (weight 0)** (grade C)

Grade C: the ingestion-quality mechanism is plausible and the type is genuinely widely deployed (100K-1M domains, still first-class in the schema.org vocabulary as of release 30.0), but not one vendor — Google, Microsoft, OpenAI, Apple — documents any consumer reading HowTo today, and Google explicitly deprecated the only consumer that ever existed. The rubric routes wide-adoption grade C to 'dead-but-informative-candidate'. If kept, it must be rewritten honestly: drop the false claim that 'AI agents use HowTo schema to present step-by-step instructions' (no vendor doc supports it), reframe as an unverified ingestion-hygiene hint, and cite the GEO-16 structured-data-pillar finding rather than implying a named consumer. Its current shape — low priority, warn when no stepped pages exist — is already the mildest form, which is the only reason it is a candidate rather than an outright delete.

## Sources

- **[Changes to HowTo and FAQ rich results](https://developers.google.com/search/blog/2023/08/howto-faq-changes)** — Google Search Central Blog (announcement, URL verified 2026-08-21)
  - Posted 2023-08-08; updated 2023-09-14: 'As of September 13, Google Search no longer shows How-to rich results on desktop, which means this result type is now deprecated.' Rich Results Test support dropped in 30 days, Search Console API in 180 days. Also: 'Structured data that's not being used does not cause problems for Search, but also has no visible effects in Google Search.'
- **[Google Search documentation updates — how-to deprecation](https://developers.google.com/search/updates#how-to-deprecation)** — Google Search Central (vendor-doc, URL verified 2026-08-21)
  - 2023-09-14 entry: 'Removed the How-to structured data documentation, as this rich result is no longer shown in search results, on both desktop and mobile devices.' The former doc URL /search/docs/appearance/structured-data/how-to now 301s here (verified by curl -L). Same changelog: FAQ rich results fully removed 2026-06-15; sitelinks search box removed 2024-11-29.
- **[schema.org: HowTo](https://schema.org/HowTo)** — schema.org (spec, URL verified 2026-08-21)
  - Type is active — not deprecated, not attic, not pending. Usage: 100K - 1M domains (Google web index, July 2026). Present 12 times in the official schemaorg-current-https.jsonld vocabulary dump.
- **[Actions from web content — overview](https://developers.google.com/assistant/content/overview)** — Google Assistant developers (vendor-doc, URL verified 2026-08-21)
  - Surviving web-content Assistant integrations are FAQs, Media, News and Podcasts. How-to guides and Recipes are no longer listed. developers.google.com/assistant/content/howto returns HTTP 404 (verified by curl).
- **[AI Answer Engine Citation Behavior: An Empirical Analysis of the GEO16 Framework](http://arxiv.org/abs/2509.10762)** — arXiv (study, URL verified 2026-08-21)
  - 1,702 citations across Brave Summary, Google AI Overviews and Perplexity; 1,100 URLs audited. 'Pillars related to Metadata and Freshness, Semantic HTML, and Structured Data showed the strongest associations with citation.' Pillar-level only — does not isolate HowTo or any specific type.
- **[NLWeb repository grep for HowTo](https://github.com/nlweb-ai/NLWeb)** — Microsoft / nlweb-ai (repo, URL verified 2026-08-21)
  - Cloned and grepped: 'HowTo' appears in 0 files across .py/.md/.json/.ts, while 'Recipe' appears in 33. Microsoft's schema.org-based agent framework does not consume HowTo.

## Review history

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **informative** (kept as informative, weight 0).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.
