---
audit: structured-data/schema-validation
category: structured-data
source_file: packages/core/src/audits/structured-data/schema-validation.ts
slug: schema-validation
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - w3c-json-ld-11
  - w3c-jsonld-api
  - google-intro-structured-data
  - webdatacommons-2024-stats
  - searchviu-schema-ai-fetch-test
public_extra:
  - Browser view
---

# schema-validation (`3.2`)

> structured-data · source `schema-validation.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

AI agents parse @context and @type to identify entity types in your structured data. Blocks missing these properties are silently ignored by every schema consumer, including Google, ChatGPT plugins, and RAG pipelines. Add "@context": "https://schema.org" and a valid @type to each block.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** A top-level JSON-LD node object with no active `@context` has its terms dropped during JSON-LD expansion. It therefore produces zero schema.org statements. Google's structured-data parser records no entity for that block, and the block is ineligible for any feature that consumes structured data.

**Grade: A** — the mechanism is a ratified W3C Recommendation (JSON-LD 1.1 expansion resolves keys against the active context) and Google is a named consumer that documents parsing JSON-LD into entities.

**Evidence:**

- JSON-LD 1.1 is a W3C Recommendation dated 16 July 2020. The spec states "A context is used to map terms to IRIs". A term with no active context is therefore not an IRI, and carries no schema.org meaning — https://www.w3.org/TR/json-ld11/ (verified 2026-08-21)
- The companion Recommendation (JSON-LD 1.1 Processing Algorithms and API, 16 July 2020) defines the Expansion Algorithm that resolves every entry key against the active context; this is the normative step the audit's signal depends on — https://www.w3.org/TR/json-ld11-api/ (verified 2026-08-21)
- Google names itself as a consumer of the format and reads it as entities: "Google can read JSON-LD data when it is dynamically injected into the page's contents". It treats the three encodings alike: JSON-LD, Microdata and RDFa are "all 3 formats are equally fine for Google". It also requires completeness — "You must include all the required properties for an object to be eligible for appearance in Google Search with enhanced display" — https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data (verified 2026-08-21)
- Adoption of the format is at web scale: JSON-LD extracted from 833.8M URLs across 11.6M domains in the October 2024 Common Crawl — https://webdatacommons.org/structureddata/2024-12/stats/stats.html (verified 2026-08-21)

**Counter-evidence:** The spec does **not** require `@type`. JSON-LD 1.1 §9.2 defines a node object purely by the absence of `@value`/`@list`/`@set`; `@type` is optional and a typeless nested map is a legitimate property value that conforming processors read as such. Google supports Microdata on equal terms, where `<div itemscope itemprop="offers">` without `itemtype` is idiomatic and valid. The audit's assertion that blocks missing `@type` are "silently ignored by every schema consumer, including Google, ChatGPT plugins, and RAG pipelines" is therefore false for nested nodes — the graded mechanism holds only for top-level entity blocks. The "RAG pipelines" half of the claim is separately unsupported: in a controlled fetch test a price present only in JSON-LD was retrieved by 0 of 5 systems (ChatGPT, Claude, Gemini, Perplexity, Google AI Mode) — https://www.searchviu.com/en/schema-markup-and-ai-in-2025-what-chatgpt-claude-perplexity-gemini-really-see/ (verified 2026-08-21)

## Browser view

No browser-agent tool reviewed documents reading structured data, so no browser consumer is claimed. The browser view reports only whether the blocks in the captured DOM pass the existing context and type checks. It claims nothing about crawler delivery, rich results or agent behaviour.

The snapshot path reuses this audit on each complete, unredacted, non-loading DOM capture that carries readable text. It reports the original static verdict as an unscored browser finding. It does not prove HTTP delivery, computed appearance, a complete accessibility tree, live form state, or action success. The source and page URL accompany every finding. Existing implementation limits still apply.

The individual evidence review and limits appear in [Browser-rendered snapshot assessment](../../../architecture/browser-snapshots.md#supported-audit-inventory). The explicit eligibility record lives in `packages/core/src/snapshot-eligibility.ts`. Original crawler grades, tiers, and weights stay unchanged.

## Implementation deviations

- Browser snapshots provide serialized markup observations only.
- The browser assessment is informative with weight 0. It does not extend the
  crawler scoring claim to browser task success.
- Truncated, redacted and still-loading captures produce missing-evidence
  records, not verdicts.
