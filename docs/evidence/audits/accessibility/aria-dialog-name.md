---
audit: accessibility/_a11y
audit_id: "7.9"
category: accessibility
source_file: packages/core/src/audits/accessibility/_a11y.ts
slug: aria-dialog-name
review_verdict: fix
severity: medium
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# Dialogs have accessible names (`7.9`)

> accessibility · source `_a11y.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

AI browser agents detect modals via role="dialog"/"alertdialog" and need an accessible name to understand the dialog’s purpose. Unlabeled dialogs trap agents in unknown UI states, blocking confirmations, forms, or cookie-consent flows.

## Code review findings (2026-08-20, 11-agent pass)

Wraps axe `aria-dialog-name`. The premise (agents need to know what a modal is before deciding how to proceed) is reasonable, but this is the audit most damaged by the CSS-stripping helper: nearly every real site ships one or more pre-rendered, class-hidden `role="dialog"` blocks (cookie consent, newsletter overlay, size guide, login modal). Those are `display:none` in the browser — axe skips them — but here they are evaluated and commonly fail, producing a 'high' priority violation for markup users never see.

**Required fix:** Two concrete changes: (a) restore a display:none model (see 7.4 fix) so hidden pre-rendered dialogs are excluded as they are in a real browser; (b) extend the selector to `dialog, [role="dialog"], [role="alertdialog"]` so the recommended native element is actually audited, otherwise the guidance and the check contradict each other.

**False-positive risks:**
- CSS blindness on hidden pre-rendered modals — the dominant false-positive scenario for this rule (`excludeHidden: true` is defeated because only inline styles survive `stripStyles()`).
- Dialogs mounted by JS at open time (React portals, `<dialog>` created on demand) are absent from static HTML → `inapplicable` → `na`, i.e. the sites with the most agent-hostile modals get no signal.
- `noNamingMethodMatch` excludes combobox-popup dialogs and elements with naming methods, which is faithful to axe but means the audit result varies with unrelated markup details, making the na/pass boundary hard to explain in the report.
- A `<dialog>` element without role and without label is not matched at all (selector is `[role="dialog"], [role="alertdialog"]`) — the audit's own fix text recommends 'Prefer the native <dialog> element', which moves markup OUT of the audit's coverage.
- Binary + no count; failing target is typically `div.modal`.

**Test gaps:**
- No HTML-level test for this audit.
- No hidden-modal fixture (the exact false-positive case).
- No native `<dialog>` fixture proving the coverage hole created by the audit's own recommendation.
- No fixture with `aria-labelledby` pointing at a heading inside the dialog.

**Overlaps with:** _none_

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
