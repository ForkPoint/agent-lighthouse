---
audit: operability-safety/aria-attributes
category: operability-safety
source_file: packages/core/src/audits/operability-safety/aria-attributes.ts
slug: aria-attributes
evidence_grade: A
disposition: "keep"
reviewed: 2026-08-21
sources:
  - w3c-aria-12-states
  - probe-aria-snapshot-images
  - playwright-mcp-repo
  - chrome-devtools-mcp-tools
  - axe-aria-valid-attr-value
  - w3c-accname-11
---

# Valid ARIA attributes (`7.12`)

> operability-safety · source `_a11y.ts` · review verdict **keep** · evidence grade **A** · disposition: **keep**

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

## Evidence (2026-08-21)

**Mechanism claim:** ARIA states and properties reach the accessibility tree only when the attribute name and its value are valid for the element's role; WAI-ARIA 1.2 defines the allowed value type for each state and property. An invalid attribute or token is not exposed at all — `aria-expanded="yes"`, a misspelled `aria-*` name, or an `aria-controls` idref that resolves to nothing. The `expanded`, `checked`, `disabled` and `selected` fields that agent snapshots print are then simply absent, and the agent reads no state where state exists.

**Grade: A** — WAI-ARIA 1.2 is a ratified W3C Recommendation, and Playwright documents that its accessibility-tree snapshot carries exactly these ARIA-derived properties, so a corrupted value provably changes what the agent sees.

**Evidence:**
- WAI-ARIA 1.2, W3C Recommendation 06 June 2023, defines each state/property's allowed value type and that user agents expose the default when a state is undefined for the role — https://www.w3.org/TR/wai-aria-1.2/#state_prop_def (verified 2026-08-21)
- Playwright ARIA snapshots include "specific ARIA attributes, such as `checked`, `disabled`, `expanded`, `invalid`, `level`, `pressed`, or `selected`" alongside role and accessible name — https://playwright.dev/docs/aria-snapshots (verified 2026-08-21)
- Playwright MCP builds the model's whole view of the page from that tree ("Uses Playwright's accessibility tree, not pixel-based input") — https://github.com/microsoft/playwright-mcp (verified 2026-08-21)
- Chrome DevTools MCP `take_snapshot` is "based on the a11y tree" and its click/fill tools consume uids from it — https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md (verified 2026-08-21)
- axe rule: ARIA values "must be spelled correctly and correspond to values that make sense for a particular attribute in order to perform the intended accessibility function"; a checkbox role "will become non-functional if given a value outside the three allowed options" (impact: critical) — https://dequeuniversity.com/rules/axe/4.10/aria-valid-attr-value (verified 2026-08-21)
- Accessible Name and Description Computation 1.1 (W3C Recommendation, 18 December 2018) governs the idref-based `aria-labelledby`/`aria-describedby` values this audit validates — https://www.w3.org/TR/accname-1.1/ (verified 2026-08-21)

**Counter-evidence:** The four bundled rules are not equally load-bearing for an agent: `aria-prohibited-attr` (e.g. an `aria-label` on a plain `<div>`) has no effect on any state the agent acts upon, while `aria-valid-attr-value` on `aria-expanded`/`aria-checked` does. No vendor agent doc names ARIA attribute validity specifically; the proven consumer path is the browser's accessibility tree, which the agent tools then serialise. The audit's idref checks also resolve against static HTML, so hydration-deferred targets are flagged although a real browser resolves them.
