# Architecture and test debt

This file holds unresolved work that has evidence but no implementation phase.
It is not a plan. A phase plan may take one row only after it re-measures the
claim. Closed work leaves this file and stays in Git history.

|   # | debt                               | status on 2026-09-02 | next owner                     |
| --: | :--------------------------------- | :------------------- | :----------------------------- |
|   1 | Corpus skips accessibility results | Closed               | Resolved (a11y-corpus.test.ts) |
|   2 | Two smaller test and API debts     | Open                 | Separate cleanup               |

The hostile-state branch first recorded these items. The sections below retain
the evidence needed to start each fix.

## 1. The corpus never exercises the accessibility audits (Resolved)

Resolved in `packages/core/src/tests/a11y-corpus.test.ts`. Rather than inflating
the 41-page `real-page-corpus.test.ts` (which sits at 75–80 s against the 120 s cap),
a dedicated test suite runs `runA11yForHtml` on representative diverse real pages
(public sector, public health, forum, storefront, shell) in ~3.2 s, proving that
all 17 `A11yBackedAudit`s execute, generate valid schema-compliant results, and
accurately exercise pass, fail (with node targets), warn, and na states on real DOMs.

## 2. Smaller items

- `packages/core/src/tests/audit-sources.ts` duplicates about fifteen lines of
  `scripts/lib/requires-analysis.mjs`. Importing the `.mjs` breaks
  `pnpm typecheck`; both available fixes were ruled out.
- The corpus fixture harness hands every audit `allEvidenceMet()`, so the corpus
  can never exercise the evidence gate. The hostile-state suite is the only place
  those guards are proven.
