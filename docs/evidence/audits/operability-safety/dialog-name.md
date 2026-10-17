---
audit: operability-safety/dialog-name
category: operability-safety
source_file: packages/core/src/audits/operability-safety/dialog-name.ts
slug: dialog-name
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - probe-aria-snapshot-images
  - playwright-mcp-repo
  - chrome-devtools-mcp-tools
  - w3c-accname-11
  - aria-apg-dialog-modal
  - axe-aria-dialog-name
---

# Dialogs have accessible names (`7.9`)

> operability-safety · source `_a11y.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

AI browser agents detect modals via role="dialog"/"alertdialog" and need an accessible name to understand the dialog’s purpose. Unlabeled dialogs trap agents in unknown UI states, blocking confirmations, forms, or cookie-consent flows.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** An element with `role="dialog"` or `role="alertdialog"` is emitted as a `dialog` node into the accessibility tree that agent snapshot tools read — Playwright MCP `browser_snapshot`, chrome-devtools-mcp `take_snapshot`. Its accessible name is computed per accname. With no `aria-label` and no `aria-labelledby` the node is emitted unnamed, so an agent that selects targets by role and accessible name cannot identify the modal it is blocked by.

**Grade: A** — the accessible-name computation is a W3C Recommendation. Two shipping agent tool-chains document that their entire page representation is the accessibility tree, with role and accessible name. An unnamed dialog is therefore provably an unnamed node in what the agent reads.

**Evidence:**

- Playwright ARIA snapshots are "a YAML representation of the accessibility tree of a page" capturing "roles, attributes, values, and text content", i.e. role plus accessible name per node — https://playwright.dev/docs/aria-snapshots (verified 2026-08-21)
- Playwright MCP (the reference browser MCP server) "Uses Playwright's accessibility tree, not pixel-based input… No vision models needed, operates purely on structured data"; its click/type tools take an "Exact target element reference from the page snapshot" — https://github.com/microsoft/playwright-mcp (verified 2026-08-21)
- Chrome DevTools MCP `take_snapshot` returns "a text snapshot of the currently selected page based on the a11y tree… lists page elements along with a unique identifier (uid)", and `click`/`fill` take that uid — https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md (verified 2026-08-21)
- Accessible Name and Description Computation 1.1 is a W3C Recommendation (18 December 2018) defining how user agents derive the name browsers expose — https://www.w3.org/TR/accname-1.1/ (verified 2026-08-21)
- ARIA Authoring Practices requires a dialog to have "a value set for the aria-labelledby property that refers to a visible dialog title" or "a label specified by aria-label" — https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ (verified 2026-08-21)
- axe rule rationale: "Screen reader users are not able to discern the purpose of elements with `role="dialog"` or `role="alertdialog"` that do not have an accessible name" (impact: serious; Deque best practice, not a WCAG SC) — https://dequeuniversity.com/rules/axe/4.10/aria-dialog-name (verified 2026-08-21)

**Counter-evidence:** No vendor agent doc names dialog labelling specifically; an agent can still read the dialog's inner text from the snapshot subtree, so the missing name degrades rather than blocks comprehension. The rule is a Deque best practice rather than a WCAG success criterion. The signal's grade does not rescue this audit's implementation, which evaluates class-hidden pre-rendered dialogs and does not match a bare `<dialog>` element.
