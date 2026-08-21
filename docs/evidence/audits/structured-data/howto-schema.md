---
audit: structured-data/howto-schema
audit_id: "3.11"
category: structured-data
source_file: packages/core/src/audits/structured-data/howto-schema.ts
slug: howto-schema
review_verdict: delete
severity: medium
evidence_grade: C
disposition: "informative, weight 0 (approved 2026-08-21)"
reviewed: 2026-08-21
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
- `hasSequentialNumberedHeadings` counts across ALL heading levels mixed together, so an h2 '1. Overview' followed by an unrelated h4 '2 year warranty' registers as a sequence.

**Test gaps:**
- No test for step numbers rendered outside the heading text (span/CSS counter) — the normal real-world pattern the regex misses
- No non-English step-heading test
- No test for numeric non-step headings ('2023 results') falsely triggering the requirement
- No test for a single-object `step` or `HowToSection`
- No test asserting the no-steps branch should be `na` rather than `warn`

**Overlaps with:** _none_

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/structured-data/howto-schema.md](../../deletions/structured-data/howto-schema.md). Outcome: **dead-but-informative-candidate**, grade C.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
