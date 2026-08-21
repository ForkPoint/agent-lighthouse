---
audit: accessibility/_a11y
audit_id: "7.10"
category: accessibility
source_file: packages/core/src/audits/accessibility/_a11y.ts
slug: aria-hidden-body
review_verdict: fix
severity: low
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# Page exposed to the accessibility tree (`7.10`)

> accessibility · source `_a11y.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

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
