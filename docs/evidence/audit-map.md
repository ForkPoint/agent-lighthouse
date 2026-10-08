# Agent Lighthouse Audit Map

Canonical inventory and lifecycle map of all Agent Lighthouse audits.

This document serves as the human-readable index for [`docs/evidence/audit-map.json`](./audit-map.json),
which is the central machine-readable index for all active, merged, and sunset audits.
Current fields come from registry metadata. Evidence dossiers govern consumer claims.
Review notes remain a dated snapshot; they do not establish current behavior or passing tests.

## Summary

- **Total Registered Audits:** 215 across 8 categories
- **Historical v1 Legacy Audits:** 207 (181 carried forward, 26 sunset)
- **Sunset Dossiers Preserved:** 27 under `docs/evidence/sunset/`
- **Merged Dossiers Preserved:** 42 under `docs/evidence/merged/`
- **Audits with Review Notes:** 215; missing: 0

## Active Audits by Category

| Category | Active Audits |
| :--- | :--- |
| `access-crawl-control` | 37 |
| `agent-interfaces` | 24 |
| `agentic-commerce` | 10 |
| `answer-readiness` | 33 |
| `content-extraction` | 27 |
| `machine-discovery` | 24 |
| `operability-safety` | 46 |
| `structured-data` | 14 |

## Audit Lifecycle & Taxonomy

Agent Lighthouse audits follow strict evidence governance (defined in [`docs/evidence/policy.md`](./policy.md)):

1. **Active (`audits/`)**: Currently registered and evaluated audits under `packages/core/src/audits/`. Every active audit possesses an evidence dossier in `docs/evidence/audits/<category>/<slug>.md`.
2. **Sunset (`sunset/`)**: Audits permanently retired because vendor evidence demonstrated no consumer impact (Grade D/unproven). Their evidence and removal rationale are permanently preserved under `docs/evidence/sunset/` and `docs/evidence/sunset/not-a-factor.md`.
3. **Merged (`merged/`)**: Audits whose signals were consolidated into another audit. The source dossier is retained under `docs/evidence/merged/`.

## Machine-Readable Dataset

The central index is [`audit-map.json`](./audit-map.json), format version 5.
Start with `readingGuide`, then select records from `audits` by exact ID.
The format version describes this file, not the package release version.

| Field | Meaning / owner |
| :--- | :--- |
| `purpose` | Declared intent from the registry description; not proof of a consumer claim. |
| `features`, `priority` | Search tags and default priority from audit metadata. Tags are not guards. |
| `applicability` | Current page-type gate. An empty type list is unrestricted by type; body and evidence guards still apply. |
| `requires` | Current scan-evidence requirements. |
| `tier`, `evidenceGrade`, `weight`, `scoreDisplayMode` | Scoring contract; eligibility still depends on the scan. |
| `enabledByDefault` | False for experimental audits. |
| `source`, `test`, `dossier` | Repository-relative implementation, test, and evidence paths. |
| `review` | P2 baseline scope/absence notes, proposed changes, and acceptance criteria. Historical, not current execution proof. |
| `legacyIds` | Links to preserved migration history. |

Authoring rule: omit `applicablePageTypes` for common checks. Restrict a check only
when its dossier supports a purpose-specific population. Broad lists are not a
substitute for feature evidence. The index records current behavior, including
migration lists; it does not approve that behavior. See the
[scope rule and inspected lists](../architecture/audits.md#511-default-scope-and-page-type-restrictions).

Missing reviews appear as `null` and in `summary.auditsWithoutReview`.
A test file link does not establish test coverage. A review's acceptance criteria
do not mean those tests exist or pass. The execution record names completed work.

For a small LLM input, select only the records and fields needed:

```bash
# One complete audit record
jq '.audits[] | select(.id == "structured-data/article-schema")' docs/evidence/audit-map.json

# All purpose-specific checks, one compact JSON object per line
jq -c '.audits[] | select(.applicability.pageTypeGate == "restricted") | {id, purpose, applicability, requires, review}' docs/evidence/audit-map.json

# Search feature tags
jq '.audits[] | select(.features | index("article")) | {id, purpose, source, dossier}' docs/evidence/audit-map.json
```

Edit runtime fields in the audit's static metadata. Edit evidence and consumer
limits in its dossier. Preserve the P2 review as a baseline; record completed
changes in the execution plan. Regenerate the index after edits. The existing
CI audit-map check rejects stale output and missing source, test, or dossier paths.
No audit verdict, grade, or weight changes when the index is generated.

To rebuild or validate the map:
```bash
pnpm build:audit-map    # Rebuilds audit-map.json from codebase state
pnpm check:audit-map    # Validates audit-map.json against code and disk
```
