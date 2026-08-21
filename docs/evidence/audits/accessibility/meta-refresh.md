---
audit: accessibility/_a11y
audit_id: "7.20"
category: accessibility
source_file: packages/core/src/audits/accessibility/_a11y.ts
slug: meta-refresh
review_verdict: keep
severity: low
evidence_grade: unrated
disposition: "keep"
reviewed: 2026-08-21
---

# No time-based auto-refresh/redirect (`7.20`)

> accessibility · source `_a11y.ts` · review verdict **keep** · evidence grade **unrated** · disposition: **keep**

## What it checks

A <meta http-equiv="refresh"> that reloads/redirects after a delay disrupts an agent mid-read and can trap it in unexpected navigation.

## Code review findings (2026-08-20, 11-agent pass)

Wraps `meta-refresh`. Rare but a real hazard: a timed `<meta http-equiv="refresh">` genuinely changes the document under an agent mid-read, and the check correctly allows delay 0 (instant redirect) via `options: { minDelay: 0, maxDelay: 72000 }`. Cheap, correct, low noise. Keep.

**Required fix:** _none — audit is sound as implemented_

**False-positive risks:**
- `excludeHidden: false` with selector `meta[http-equiv="refresh"][content]` — a meta refresh present inside a `<noscript>` block (a legacy no-JS fallback that a JS-capable agent never follows) is still flagged.
- Only the first 3 scanned pages are evaluated; a legacy sub-page with a refresh on a large site is missed while the report reads site-wide.
- Selector is an exact attribute-value match, so `http-equiv="Refresh"` (capital R, valid HTML and case-insensitive in browsers) is NOT matched → false negative on a real occurrence.
- CSR SPA → the rule is inapplicable, `na`.

**Test gaps:**
- No HTML-level test for this audit.
- No fixture with `http-equiv="Refresh"` capitalised (the case-sensitivity miss).
- No fixture with `content="0;url=..."` asserting the allowed instant-redirect pass.
- No `<noscript>`-wrapped fixture.

**Overlaps with:** _none_

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
