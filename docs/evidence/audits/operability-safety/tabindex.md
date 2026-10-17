---
audit: operability-safety/tabindex
category: operability-safety
source_file: packages/core/src/audits/operability-safety/tabindex.ts
slug: tabindex
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - whatwg-tabindex
  - playwright-mcp-repo
  - chrome-devtools-mcp-tools
  - probe-aria-snapshot-images
---

# No positive tabindex (logical focus order) (`7.21`)

> operability-safety · source `_a11y.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

Positive tabindex values force a non-DOM focus order. Agents that traverse the page by focus order then encounter a confusing, non-linear sequence.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** A `tabindex` greater than 0 places the element in a tabindex-ordered focus navigation scope ahead of every `tabindex="0"` element, so a consumer that reaches controls by pressing Tab visits them in a non-DOM order.

**Grade: C** — the focus-order effect is ratified in the HTML Standard and implemented by all browsers. But the audit's stated agent mechanism, "agents that traverse the page by focus order", has no documented consumer. Every agent tool-chain with published docs addresses elements by accessibility-tree reference, not by tab sequence.

**Evidence:**

- WHATWG HTML Standard: a positive `tabindex` places the element "in the tabindex-ordered focus navigation scope", ordered by its numeric value. The advisory follows: "Developers should use caution when using values other than 0 or −1 for their `tabindex` attributes as this is complicated to do correctly" — https://html.spec.whatwg.org/multipage/interaction.html#the-tabindex-attribute (verified 2026-08-21)
- The proven agent action path is reference-based, not tab-based. Playwright MCP click and type take an "Exact target element reference from the page snapshot" — https://github.com/microsoft/playwright-mcp (verified 2026-08-21). chrome-devtools-mcp `click` and `fill` take "The uid of an element on the page from the page content snapshot". That uid is produced by `take_snapshot` "based on the a11y tree" — https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md (verified 2026-08-21)
- Playwright's accessibility-tree serialisation exposes role, name and ARIA state, but no focus-order information at all — https://playwright.dev/docs/aria-snapshots (verified 2026-08-21)

**Counter-evidence:** None of the searched vendor or tool documentation describes an agent that traverses a page by sequential focus order; the accessibility-tree snapshot an agent reads carries no tab-order data, so a scrambled tab order is invisible to it. The defensible consumer is a human keyboard/AT user (WCAG 2.4.3 Focus Order), which is outside this module's stated scope of non-human consumers. The rule is a human keyboard-navigation requirement with an agent rationale attached to it. Vision/computer-use agents that do send Tab keys are a plausible but undocumented exception.
