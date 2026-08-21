---
audit: accessibility/_a11y
audit_id: "7.21"
category: accessibility
source_file: packages/core/src/audits/accessibility/_a11y.ts
slug: tabindex
review_verdict: fix
severity: low
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# No positive tabindex (logical focus order) (`7.21`)

> accessibility · source `_a11y.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

Positive tabindex values force a non-DOM focus order. Agents that traverse the page by focus order then encounter a confusing, non-linear sequence.

## Code review findings (2026-08-20, 11-agent pass)

Wraps `tabindex` (no positive tabindex). Faithful port and harmless, but the justification is cargo cult for this framework's stated purpose: the description asserts 'Agents that traverse the page by focus order then encounter a confusing, non-linear sequence' — DOM/accessibility-tree-driven agents do not walk tab order, and the ones that do (computer-use style) read a rendered snapshot, not the tab sequence. This is a human keyboard-navigation rule wearing an agent rationale.

**Required fix:** Keep the rule but rewrite `description`/`guidance.impact` to state the actual, defensible reason (positive tabindex is a symptom of hand-managed focus and breaks keyboard/AT users) instead of inventing an agent focus-order traversal. Leave priority at 'low'.

**False-positive risks:**
- Third-party widgets (older date pickers, embedded forms, some CMS plugins) still emit positive tabindex; the site owner cannot fix vendor markup but takes the score hit.
- CSS blindness: positive tabindex on hidden template clones is evaluated.
- Binary with no count and weak selectors — one legacy widget zeroes the audit identically to a systematically scrambled page.
- CSR SPA → `na`.

**Test gaps:**
- No HTML-level test for this audit.
- No fixture with `tabindex="0"`/`"-1"` asserting they pass.
- No third-party-widget fixture.

**Overlaps with:** _none_

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
