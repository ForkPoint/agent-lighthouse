---
"@forkpoint/agent-lighthouse-core": major
"@forkpoint/agent-lighthouse": major
---

Page type becomes consent (Phase 3 of audit architecture migration):

- Added `ScanOptions.pageType?: PageType` and CLI `--page-type` flag.
- Added `PageContext.pageTypeSource: 'declared' | 'detected'`.
- Renamed `AuditMeta.applicablePageTypes` to `AuditMeta.pageTypes`.
- Introduced runner scope function: typed audits matching detected page types run in `informative` mode (unscored); only user-declared page types authorize scoring.
- Category mass calculations updated to use `assessedMass`.
- Removed direct `page.pageType` accesses across all 17 audit sources.
