---
audit: accessibility/_a11y
audit_id: "7.14"
category: accessibility
source_file: packages/core/src/audits/accessibility/_a11y.ts
slug: duplicate-id-aria
review_verdict: fix
severity: high
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# Unique IDs for ARIA references (`7.14`)

> accessibility · source `_a11y.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

aria-labelledby / aria-describedby / for resolve by id. Duplicate ids make resolution ambiguous, so an agent may read the wrong label or description.

## Code review findings (2026-08-20, 11-agent pass)

Wraps `duplicate-id-aria`. The signal is valid (a duplicated id makes an aria-labelledby resolve to the wrong text), but as wired the audit is broken: `duplicate-id-aria` is declared `reviewOnFail: true` in rules.ts, so every real violation becomes rule status `incomplete`; the base class then reports `warn` only when NO page and no other status is a pass — and since the audit has exactly one rule but three scanned pages, a duplicate-id violation on the homepage is converted to PASS as soon as any other page's `duplicate-id-aria` passes. The audit can essentially never fail, and frequently reports a clean pass over a real violation.

**Required fix:** In `A11yBackedAudit.audit()`, track incomplete separately from pass and let incomplete win over pass (report `warn` whenever any page/rule is incomplete, even if others pass). Additionally propagate failing nodes for reviewOnFail rules: in `runRule`, when `rule.reviewOnFail` converts a fail to incomplete, still collect the offending targets and return them so the warn message names the duplicated ids.

**False-positive risks:**
- FALSE NEGATIVE (the serious one): `if (sawFail)`… never triggers for this audit because reviewOnFail converts fails to incomplete; then `sawIncomplete && !sawPass` is false whenever any other scanned page passes → reported as 'accessibility checks pass. No violations'. A site with duplicated ids on its homepage is told it is clean.
- Even in the best case the user gets 'manual review advised' with `nodes: []` — runRule returns `{status:'incomplete', nodes: []}` (rules.ts:372), so no offending id or selector is ever reported.
- Duplicate ids caused by repeated third-party embeds (multiple copies of the same widget snippet) are technically true positives but unfixable by the site owner, and get no attribution to tell them apart.
- CSS blindness is not an issue here (`excludeHidden: false`), but pre-rendered hidden template clones are the single biggest source of duplicate ids on real sites and are counted.

**Test gaps:**
- No HTML-level test with duplicated ids at all — the reviewOnFail→incomplete→swallowed-by-pass path is completely untested, which is why the defect survives.
- No multi-page fixture where one page has duplicates and another does not (the exact override case).

**Overlaps with:** `7.12`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
