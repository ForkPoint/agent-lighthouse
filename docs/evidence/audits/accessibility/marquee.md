---
audit: accessibility/_a11y
audit_id: "7.22"
category: accessibility
source_file: packages/core/src/audits/accessibility/_a11y.ts
slug: marquee
review_verdict: delete
severity: low
evidence_grade: unrated
disposition: "delete (superseded — see deletion research)"
reviewed: 2026-08-21
---

# No deprecated presentational elements (`7.22`)

> accessibility · source `_a11y.ts` · review verdict **delete** · evidence grade **unrated** · disposition: **delete (superseded — see deletion research)**

## What it checks

Deprecated elements like <marquee> and <blink> have undefined semantics and unstable text content for parsers.

## Code review findings (2026-08-20, 11-agent pass)

Wraps `marquee` + `blink`. `<blink>` was removed from every shipping browser by 2013 and `<marquee>` is a vestigial legacy element; on the modern web this audit is `inapplicable` on effectively 100% of scanned pages, so it produces `na` and nothing else. It occupies a slot in a 22-audit category and adds a line of noise to every report without ever discriminating between sites. Additionally its `none: ['is-on-screen']` composition means even a real `<marquee>` that happens to be hidden passes.

**Required fix:** Delete the audit (and the `marquee`/`blink` rules from A11Y_RULES) — it cannot change a verdict on any modern site and its stated rationale is wrong.

**False-positive risks:**
- Practically always `na` — it cannot report a wrong result because it never reports anything, which is precisely the 'no real value' case.
- If it did fire, the `is-on-screen` none-check means a hidden `<marquee>` passes, so even the intended detection is conditional on a visibility model that CSS-stripping has already broken.
- The description's claim ('unstable text content for parsers') is unfounded — `<marquee>`'s text is perfectly stable in the DOM; only its rendered position moves.

**Test gaps:**
- No HTML-level test for this audit; the rules are never exercised with `<marquee>`/`<blink>` markup anywhere in the suite.

**Overlaps with:** _none_

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
