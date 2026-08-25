---
audit: structured-data/howto-schema
category: structured-data
source_file: packages/core/src/audits/structured-data/howto-schema.ts
slug: howto-schema
evidence_grade: C
disposition: "informative, weight 0 (approved 2026-08-21)"
reviewed: 2026-08-21
signals:
  - name: HowTo JSON-LD as an ingestion-quality hint
    grade: C
    domain: structured-data
sources:
  - schemaorg-howto
  - geo-16-study
  - google-howto-faq-changes-2023
  - google-search-updates-howto
---

# howto-schema (`3.11`)

> structured-data · source `howto-schema.ts` · review verdict **delete** · evidence grade **C** · disposition: **informative, weight 0 (approved 2026-08-21)**

## What it checks

AI agents use HowTo schema to present step-by-step instructions as structured answers. Without it, agents must parse your numbered headings heuristically, which often breaks step ordering or misses steps entirely.

## Code review findings (2026-08-20, 11-agent pass)

Detects step content with an English-only regex that requires the number to be the first characters of the heading text, then demands HowTo schema — a rich-result type Google fully deprecated in 2023. The precondition-absent branch returns warn (0.5) rather than na, so every site without numbered headings pays a permanent half-point for a dead standard.

**Required fix:** Delete. If procedural-content structure is still wanted as a signal, assess it in semantic-html (does the page use `<ol>`/`<li>` for its steps) rather than demanding a deprecated schema type. At minimum, if kept: return `notApplicable` for the no-steps branch, accept single-object `step` and `HowToSection`, and replace the leading-digit regex with an `<ol>`-based detector.

**False-positive risks:**
- `h.match(/^(?:step\s+)?(\d+)[.):\s]/i)` is English-only ('Schritt', 'Étape', 'Paso', '手順', 'Шаг' are not handled) AND requires the digit to be at the start of the heading TEXT. The normal way tutorials render step numbers — a separate `<span class="step-num">1</span>` or a CSS `counter()` — produces heading text with no leading digit, so real how-to content never triggers and the audit silently exempts exactly the pages it targets.
- It over-triggers on numeric headings that are not steps: `[.):\s]` after `\d+` means headings like '2023 in review' then '2024 in review', or '1 000 customers' / '2 000 customers', satisfy the sequence and force a HowTo requirement on a changelog, an annual-report page, or a pricing table. The audit then hard-fails them.
- The no-stepped-pages branch returns `this.warn(...)` (score 0.5) instead of `notApplicable`, so a site with no procedural content is docked on every scan.
- `matchesType(obj,'HowTo') && Array.isArray(obj['step'])` rejects the valid single-step form (`"step": {"@type":"HowToStep"}`) and the `HowToSection` grouping form, failing correct markup.
- `hasSequentialNumberedHeadings` counts across all heading levels mixed together, so an h2 '1. Overview' followed by an unrelated h4 '2 year warranty' registers as a sequence.

**Test gaps:**
- No test for step numbers rendered outside the heading text (span/CSS counter) — the normal real-world pattern the regex misses
- No non-English step-heading test
- No test for numeric non-step headings ('2023 results') falsely triggering the requirement
- No test for a single-object `step` or `HowToSection`
- No test asserting the no-steps branch should be `na` rather than `warn`

**Overlaps with:** _none_

## Evidence

### Signal: HowTo JSON-LD as an ingestion-quality hint — grade C (structured-data)

**Mechanism:** A page with sequential instructions that emits `HowTo` JSON-LD hands a reader an unambiguous ordered `step[]` array. The reader no longer has to infer step boundaries and ordering from headings and prose. That is an ingestion-quality benefit which would survive the loss of any rich result.

**Grade: C** — the type is genuinely widely deployed, and still first-class in the schema.org vocabulary. Structured data as a class is associated with citation. But no vendor documents any consumer reading `HowTo` today, and Google explicitly deprecated the only consumer that ever existed.

**Evidence:**
- The type is alive and broadly deployed: schema.org/HowTo carries no deprecated, attic or pending marker and reports 100K–1M domains (Google web index, July 2026) — https://schema.org/HowTo (verified 2026-08-21)
- Pillar-level empirical support, not type-level. The GEO-16 study audited 1,702 citations across Brave Summary, Google AI Overviews and Perplexity. It found that "pillars related to Metadata and Freshness, Semantic HTML, and Structured Data showed the strongest associations with citation" — https://arxiv.org/abs/2509.10762 (verified 2026-08-21)

**Counter-evidence:** Explicit and strong. Google deprecated the rich result: "As of September 13, Google Search no longer shows How-to rich results on desktop, which means this result type is now deprecated" (https://developers.google.com/search/blog/2023/08/howto-faq-changes, verified 2026-08-21). It then removed the documentation — "Removed the How-to structured data documentation, as this rich result is no longer shown in search results" — and the old documentation URL now 301-redirects to an anchor Google named `#how-to-deprecation` (https://developers.google.com/search/updates#how-to-deprecation, verified 2026-08-21). Google also states that unused markup is inert: "Structured data that's not being used does not cause problems for Search, but also has no visible effects in Google Search." The assistant path is gone as well: `developers.google.com/assistant/content/howto` returns HTTP 404, and the surviving "Actions from web content" overview lists only FAQs, Media, News and Podcasts. Beyond Google: Microsoft's NLWeb codebase contains zero mentions of HowTo, Apple's Applebot documentation names only `isAccessibleForFree`, and OpenAI's commerce specification excludes JSON-LD sources entirely. The GEO-16 finding supports emitting structured data in general; it does not isolate this type.

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/structured-data/howto-schema.md](../../deletions/structured-data/howto-schema.md). Outcome: **dead-but-informative-candidate**, grade C.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
