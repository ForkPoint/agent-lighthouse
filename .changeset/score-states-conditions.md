---
"@forkpoint/agent-lighthouse-core": major
"@forkpoint/agent-lighthouse": major
"@forkpoint/agent-lighthouse-report": major
---

The Score States Its Conditions & The Warrant Expires (Phase 6 of audit architecture migration):

- Added `conditions` to `ScanReport` and `ScanConditionsSchema`: transparently reports the target URL, page type (`declared` vs `detected`), origin evidence status (`cached` vs `fresh`, version, and `readAt`), evidence coverage breakdown (`registryMass`, `assessedMass`, `pageMass`, `originMass`, `gatedMass`), and unscored audit breakdown.
- Updated all report renderers (`terminal`, `markdown`, `html`) to display the Scan Conditions block beside and beneath the headline score.
- Implemented `scripts/sweep-audit-reviews.mjs` and scheduled GitHub workflow `.github/workflows/audit-review-sweep.yml` to track evidence dossiers older than 6 months (180 days).
