---
audit: accessibility/_a11y
audit_id: "7.12"
category: accessibility
source_file: packages/core/src/audits/accessibility/_a11y.ts
slug: aria-valid-attr
review_verdict: keep
severity: medium
evidence_grade: unrated
disposition: "keep"
reviewed: 2026-08-21
---

# Valid ARIA attributes (`7.12`)

> accessibility · source `_a11y.ts` · review verdict **keep** · evidence grade **unrated** · disposition: **keep**

## What it checks

ARIA states and properties carry the machine-readable state agents act on (expanded, checked, disabled, labels). Invalid attributes or values corrupt that state.

## Code review findings (2026-08-20, 11-agent pass)

Bundles `aria-valid-attr`, `aria-valid-attr-value`, `aria-allowed-attr`, `aria-prohibited-attr`. These are genuine machine-readable-state correctness checks (`aria-expanded="yes"` really does corrupt what an agent reads), the port is faithful, and the failures are almost always real bugs. Keep. The notable real-world risk is idref-based values on hydrating sites.

**Required fix:** _none — audit is sound as implemented_

**False-positive risks:**
- `aria-valid-attr-value` resolves idrefs against the static document: `aria-labelledby`/`aria-controls`/`aria-describedby` pointing at elements rendered on hydration or in a JS-mounted portal are 'invalid' here but valid in a browser — a systematic false fail on Next.js/Nuxt/Remix pages that stream or defer parts of the tree.
- CSS blindness: attributes on hidden template clones (carousel/mega-menu duplicates that reuse the same `aria-controls` ids) are evaluated.
- Four rules collapsed to one binary verdict with no rule attribution in `found`, so a prohibited `aria-label` on a `<div>` (cosmetic) is indistinguishable from `aria-expanded="yes"` (functional).
- Cross-rule incomplete swallowing (categoryNotes #4a): if `aria-valid-attr` passes and `aria-valid-attr-value` is incomplete, the audit reports PASS and the needs-review signal is lost.
- CSR SPA → `na`.

**Test gaps:**
- No HTML-level test for this audit.
- No fixture with an idref target that is absent from static HTML (the hydration false-positive).
- No fixture exercising the cross-rule incomplete-swallowed-by-pass path (only the same-rule variant is tested).

**Overlaps with:** `7.11`, `7.13`, `7.14`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
