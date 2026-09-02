# Architecture and test debt

This file holds unresolved work that has evidence but no implementation phase.
It is not a plan. A phase plan may take one row only after it re-measures the
claim. Closed work leaves this file and stays in Git history.

|   # | debt                               | status on 2026-09-02 | next owner          |
| --: | :--------------------------------- | :------------------- | :------------------ |
|   1 | Corpus skips accessibility results | Open                 | Test infrastructure |
|   2 | Two smaller test and API debts     | Open                 | Separate cleanup    |

The hostile-state branch first recorded these items. The sections below retain
the evidence needed to start each fix.

## 1. The corpus never exercises the accessibility audits

About 17 audits are `notApplicable` on all 41 fixtures because `page.a11yResults`
is populated only by the orchestrator. Wiring the a11y runner into the corpus
harness needs its own runtime budget — the suite already sits at 75–99 s against
a 120 s cap.

## 2. Smaller items

- `packages/core/src/tests/audit-sources.ts` duplicates about fifteen lines of
  `scripts/lib/requires-analysis.mjs`. Importing the `.mjs` breaks
  `pnpm typecheck`; both available fixes were ruled out.
- The corpus fixture harness hands every audit `allEvidenceMet()`, so the corpus
  can never exercise the evidence gate. The hostile-state suite is the only place
  those guards are proven.
