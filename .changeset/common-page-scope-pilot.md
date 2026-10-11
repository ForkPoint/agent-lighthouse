---
"@forkpoint/agent-lighthouse-core": patch
---

Make the `single-h1` and `main-element` audits judge every scanned page without
giving the first page a special role. Reordering the same page sample no longer
changes either result. Empty samples return not applicable. Findings report
affected URLs and no longer call every scanned page a homepage.

This is the first scope correction in the planned 7.0.0 applicability migration.
It preserves audit IDs, grades, tiers, weights and public schemas. The broader
page-purpose and scoring contract changes require a separate major changeset
when implemented.
