---
audit: operability-safety/_a11y
audit_id: "7.21"
category: operability-safety
source_file: packages/core/src/audits/operability-safety/_a11y.ts
slug: tabindex
review_verdict: fix
severity: low
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# No positive tabindex (logical focus order) (`7.21`)

> operability-safety · source `_a11y.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

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

## Graded evidence (2026-08-21)

**Mechanism claim:** A `tabindex` greater than 0 places the element in a tabindex-ordered focus navigation scope ahead of every `tabindex="0"` element, so a consumer that reaches controls by pressing Tab visits them in a non-DOM order.

**Grade: C** — the focus-order effect is ratified in the HTML Standard and implemented by all browsers, but the audit's stated agent mechanism ("agents that traverse the page by focus order") has no documented consumer: every agent tool-chain with published docs addresses elements by accessibility-tree reference, not by tab sequence.

**Evidence:**
- WHATWG HTML Standard: a positive `tabindex` places the element "in the tabindex-ordered focus navigation scope" ordered by its numeric value, with the advisory "Developers should use caution when using values other than 0 or −1 for their `tabindex` attributes as this is complicated to do correctly" — https://html.spec.whatwg.org/multipage/interaction.html#the-tabindex-attribute (verified 2026-08-21)
- The proven agent action path is reference-based, not tab-based: Playwright MCP click/type take an "Exact target element reference from the page snapshot" — https://github.com/microsoft/playwright-mcp (verified 2026-08-21) — and chrome-devtools-mcp `click`/`fill` take "The uid of an element on the page from the page content snapshot" produced by `take_snapshot` "based on the a11y tree" — https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md (verified 2026-08-21)
- Playwright's accessibility-tree serialisation exposes role, name and ARIA state, but no focus-order information at all — https://playwright.dev/docs/aria-snapshots (verified 2026-08-21)

**Counter-evidence:** None of the searched vendor or tool documentation describes an agent that traverses a page by sequential focus order; the accessibility-tree snapshot an agent reads carries no tab-order data, so a scrambled tab order is invisible to it. The defensible consumer is a human keyboard/AT user (WCAG 2.4.3 Focus Order), which is outside this module's stated scope of non-human consumers — matching the code review's finding that the description is a human keyboard-navigation rule with an agent rationale attached. Vision/computer-use agents that do send Tab keys are a plausible but undocumented exception.
