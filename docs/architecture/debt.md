# Architecture and test debt

This file holds unresolved work that has evidence but no implementation phase.
It is not a plan. A phase plan may take one row only after it re-measures the
claim. Closed work leaves this file and stays in Git history.

|   # | debt                                 | status on 2026-09-02 | next owner       |
| --: | :----------------------------------- | :------------------- | :--------------- |
|   1 | Corpus fixture harness evidence gate | Open                 | Separate cleanup |

The hostile-state branch first recorded these items. The section below retains
the evidence needed to start each fix.

## 1. Smaller items

- The corpus fixture harness hands every audit `allEvidenceMet()`, so the corpus
  can never exercise the evidence gate. The hostile-state suite is the only place
  those guards are proven.
