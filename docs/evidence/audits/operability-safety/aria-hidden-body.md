---
audit: operability-safety/aria-hidden-body
category: operability-safety
source_file: packages/core/src/audits/operability-safety/aria-hidden-body.ts
slug: aria-hidden-body
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - w3c-aria-12-hidden
  - probe-aria-snapshot-images
  - playwright-mcp-repo
  - chrome-devtools-mcp-tools
  - axe-aria-hidden-body
  - playwright-mcp-snapshots
  - chrome-devtools-mcp-tool-reference
public_extra:
  - Browser view
---

# Page exposed to the accessibility tree (`7.10`)

> operability-safety · source `_a11y.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

aria-hidden="true" on the document body removes the entire page from the accessibility tree. AI browser agents that navigate via the accessibility tree would see nothing at all.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** `aria-hidden="true"` on `<body>` excludes the element and all its descendants from the accessibility tree, per WAI-ARIA 1.2 §7.1. An agent whose page representation is built from that tree — Playwright MCP `browser_snapshot`, chrome-devtools-mcp `take_snapshot` — receives an empty snapshot. It can then neither read nor act on any page content.

**Grade: A** — WAI-ARIA 1.2 is a ratified W3C Recommendation whose accessibility-tree exclusion is implemented by every browser, and the two documented agent snapshot tools state their representation _is_ that tree, so the empty-page outcome is deterministic rather than inferred.

**Evidence:**

- WAI-ARIA 1.2 is a W3C Recommendation (06 June 2023); §7.1 "Excluding Elements from the Accessibility Tree" specifies that `aria-hidden="true"` removes the element and its descendants from the tree — https://www.w3.org/TR/wai-aria-1.2/#aria-hidden (verified 2026-08-21)
- Playwright ARIA snapshots are "a YAML representation of the accessibility tree of a page" — https://playwright.dev/docs/aria-snapshots (verified 2026-08-21)
- Playwright MCP "Uses Playwright's accessibility tree, not pixel-based input… operates purely on structured data" — https://github.com/microsoft/playwright-mcp (verified 2026-08-21)
- Chrome DevTools MCP `take_snapshot` gives the model "a text snapshot of the currently selected page based on the a11y tree", and interaction tools address elements only by uids from that snapshot — https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md (verified 2026-08-21)
- axe rule: "Document content is not accessible to assistive technology if `<body aria-hidden="true">`" (impact: critical) — https://dequeuniversity.com/rules/axe/4.10/aria-hidden-body (verified 2026-08-21)

**Counter-evidence:** Screenshot/pixel-driven agents (computer-use style) are unaffected — they never consult the accessibility tree, so the failure is total for tree-based agents and invisible to vision-based ones. The condition is also vanishingly rare in static HTML. Its realistic occurrence is a modal library setting `aria-hidden` on the root at open time, which happens only after JS runs — and this pipeline never observes that. A high grade for the signal therefore coexists with a near-zero hit rate for the audit as implemented.

## Browser view

Playwright MCP "uses accessibility snapshots instead of screenshots", with refs "assigned to every node the accessibility tree exposes" (verified 2026-10-20). Chrome DevTools MCP `take_snapshot` takes "a text snapshot of the target page based on the a11y tree" (verified 2026-10-20). `aria-hidden="true"` on `<body>` removes the whole page from that tree, so both snapshots describe an empty page. A supplied browser snapshot is the rendered DOM those tools read, so the browser view runs this audit on it.

The browser view runs on each complete, unredacted, non-loading capture that carries readable text and whose accessibility rule pass completed. The pass runs the audit's rules over the capture HTML with page scripts off and no resource loading. A pass with no results records missing evidence instead of a verdict. The finding is informative with weight 0. It does not prove HTTP delivery, computed appearance, a complete accessibility tree, live form state, or action success. A truncated, redacted or still-loading capture records missing evidence. Existing implementation limits still apply.

The review appears in [Browser-rendered snapshot assessment](../../../architecture/browser-snapshots.md#supported-audit-inventory). The eligibility record lives in `packages/core/src/snapshot-eligibility.ts`. The crawler grade, tier and weight stay unchanged.
