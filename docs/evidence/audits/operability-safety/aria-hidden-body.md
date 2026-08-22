---
audit: operability-safety/aria-hidden-body
audit_id: "7.10"
category: operability-safety
source_file: packages/core/src/audits/operability-safety/aria-hidden-body.ts
slug: aria-hidden-body
review_verdict: fix
severity: low
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# Page exposed to the accessibility tree (`7.10`)

> operability-safety · source `_a11y.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

aria-hidden="true" on the document body removes the entire page from the accessibility tree. AI browser agents that navigate via the accessibility tree would see nothing at all.

## Code review findings (2026-08-20, 11-agent pass)

Wraps axe `aria-hidden-body`. When true it is genuinely catastrophic (the whole page vanishes from the accessibility tree), but the condition is vanishingly rare in the wild — essentially every site passes, so in a 22-audit binary average this is a free point that dilutes the discriminating audits. Correct, cheap, and near-zero information.

**Required fix:** Either fold this into 7.11/7.12 as a critical sub-rule so it stops occupying a whole slot in the binary average, or exclude always-passing structural guards from the scored average (report them as informational). At minimum add a real HTML fixture so the rule is proven to fire.

**False-positive risks:**
- The realistic occurrence — a modal library setting `aria-hidden="true"` on the root while a dialog is open — happens only after JS runs, which this static-HTML pipeline never observes, so the audit passes exactly the sites that have the bug (false negative).
- `excludeHidden: false` with `selector: 'body'` means it always has a candidate → the result is always pass/fail, never `na`, so it always contributes a full point to the category average.
- On a WAF interstitial or an error page it still passes, reinforcing an inflated accessibility score for a page that was never fetched.

**Test gaps:**
- Only the synthetic aggregation path is tested (_a11y.test.ts uses fabricated `aria-hidden-body` statuses); no HTML fixture with `<body aria-hidden="true">` ever reaches the engine in a test.

**Overlaps with:** _none_

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Graded evidence (2026-08-21)

**Mechanism claim:** `aria-hidden="true"` on `<body>` excludes the element and all descendants from the accessibility tree per WAI-ARIA 1.2 §7.1, so an agent whose page representation is built from that tree (Playwright MCP `browser_snapshot`, chrome-devtools-mcp `take_snapshot`) receives an empty snapshot and can neither read nor act on any page content.

**Grade: A** — WAI-ARIA 1.2 is a ratified W3C Recommendation whose accessibility-tree exclusion is implemented by every browser, and the two documented agent snapshot tools state their representation *is* that tree, so the empty-page outcome is deterministic rather than inferred.

**Evidence:**
- WAI-ARIA 1.2 is a W3C Recommendation (06 June 2023); §7.1 "Excluding Elements from the Accessibility Tree" specifies that `aria-hidden="true"` removes the element and its descendants from the tree — https://www.w3.org/TR/wai-aria-1.2/#aria-hidden (verified 2026-08-21)
- Playwright ARIA snapshots are "a YAML representation of the accessibility tree of a page" — https://playwright.dev/docs/aria-snapshots (verified 2026-08-21)
- Playwright MCP "Uses Playwright's accessibility tree, not pixel-based input… operates purely on structured data" — https://github.com/microsoft/playwright-mcp (verified 2026-08-21)
- Chrome DevTools MCP `take_snapshot` gives the model "a text snapshot of the currently selected page based on the a11y tree", and interaction tools address elements only by uids from that snapshot — https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md (verified 2026-08-21)
- axe rule: "Document content is not accessible to assistive technology if `<body aria-hidden="true">`" (impact: critical) — https://dequeuniversity.com/rules/axe/4.10/aria-hidden-body (verified 2026-08-21)

**Counter-evidence:** Screenshot/pixel-driven agents (computer-use style) are unaffected — they never consult the accessibility tree, so the failure is total for tree-based agents and invisible to vision-based ones. The condition is also vanishingly rare in static HTML: its realistic occurrence (a modal library setting `aria-hidden` on the root at open time) happens only after JS runs, which this pipeline never observes, so a high grade for the signal coexists with a near-zero hit rate for the audit as implemented.
