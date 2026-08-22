---
audit: operability-safety/_a11y
audit_id: "7.14"
category: operability-safety
source_file: packages/core/src/audits/operability-safety/_a11y.ts
slug: duplicate-id
review_verdict: fix
severity: high
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# Unique IDs for ARIA references (`7.14`)

> operability-safety · source `_a11y.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

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

## Graded evidence (2026-08-21)

**Mechanism claim:** `aria-labelledby`/`aria-describedby`/`for` resolve an IDREF by id lookup, which returns the first element in tree order; when two elements share an id, the accessible name computed per accname and exposed in the accessibility tree an agent reads is taken from the first occurrence — so a control referencing the second one is announced with the wrong label.

**Grade: A** — id resolution (first element in tree order) and the accname IDREF traversal are both ratified, universally implemented behavior, and role + accessible name is precisely what documented agent snapshot tools serialise for the model.

**Evidence:**
- `getElementById`: "IDs should be unique inside a document. If two or more elements in a document have the same ID, this method returns the first element found" — https://developer.mozilla.org/en-US/docs/Web/API/Document/getElementById (verified 2026-08-21)
- Accessible Name and Description Computation 1.1 (W3C Recommendation, 18 December 2018) defines the LabelledBy step: "For each IDREF: Set the current node to the node referenced by the IDREF… Compute the text alternative of the current node" — https://www.w3.org/TR/accname-1.1/ (verified 2026-08-21); the same step text is carried in the 1.2 Working Draft — https://www.w3.org/TR/accname-1.2/ (verified 2026-08-21)
- Playwright ARIA snapshots serialise each node's role and accessible name for the model — https://playwright.dev/docs/aria-snapshots (verified 2026-08-21)
- Playwright MCP and Chrome DevTools MCP both address elements by reference/uid taken from an accessibility-tree snapshot, so a wrong name is what the agent selects on — https://github.com/microsoft/playwright-mcp and https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md (both verified 2026-08-21)
- axe rule: the id "must be unique to prevent the second instance from being overlooked by assistive technology"; "only the first instance gets acted upon by client-side scripting" (impact: critical) — https://dequeuniversity.com/rules/axe/4.10/duplicate-id-aria (verified 2026-08-21)

**Counter-evidence:** Deque frames the effect as the second instance being *overlooked* rather than misresolved, and the harm only materialises when a duplicated id is actually the target of an ARIA reference or a `for` attribute — a duplicated id that nothing references changes nothing in the accessibility tree. Duplicate ids from repeated third-party embeds are true positives the site owner cannot fix. Independently of the signal's grade, this audit as wired can essentially never report the failure (reviewOnFail → incomplete → overridden by another page's pass; see code review findings above).
