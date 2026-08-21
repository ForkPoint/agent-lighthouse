---
audit: accessibility/_a11y
audit_id: "7.18"
category: accessibility
source_file: packages/core/src/audits/accessibility/_a11y.ts
slug: document-title
review_verdict: keep
severity: low
evidence_grade: unrated
disposition: "keep"
reviewed: 2026-08-21
---

# Page has a non-empty <title> (`7.18`)

> accessibility · source `_a11y.ts` · review verdict **keep** · evidence grade **unrated** · disposition: **keep**

## What it checks

The document title is the page’s identity in the accessibility tree and in agent context windows. A missing/empty title leaves the page unnamed.

## Code review findings (2026-08-20, 11-agent pass)

Wraps `document-title`. Trivially true for essentially every real site, so it contributes almost no discrimination and acts as a free point in the binary average — but it is correct, cheap, and the failure (missing/empty title) is genuinely fatal for citation and disambiguation when it happens. Keep as a floor check; it is the only audit whose synthetic aggregation path is actually tested.

**Required fix:** _none — audit is sound as implemented_

**False-positive risks:**
- Only presence/non-emptiness is checked — a site where every page ships the same generic title ('Home') passes, though that is precisely the disambiguation failure the description claims to prevent.
- Framework shells that set the title via JS (`document.title = ...` in a CSR SPA) fail on the static HTML even though every real consumer, including headless agents that execute JS, sees a title. The rule matches `html:not(html *)` with `excludeHidden: true`, so it always has a candidate and always renders a verdict.
- WAF interstitials have titles ('Just a moment...') → pass, contributing to an inflated score for a page that was never actually fetched.

**Test gaps:**
- No fixture with a JS-assigned title (SPA false fail).
- No fixture with duplicate titles across pages (the uniqueness aspect the description implies but the rule does not check).
- No fixture with a whitespace-only `<title>`.

**Overlaps with:** _none_

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
