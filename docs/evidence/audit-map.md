# Agent Lighthouse Audit Map

Canonical inventory and lifecycle map of all Agent Lighthouse audits.

This document serves as the human-readable index for [`docs/evidence/audit-map.json`](./audit-map.json),
which is the machine-readable single source of truth for all active, merged, and sunset audits.

## Summary

- **Total Active Shipping Audits:** 215 across 8 categories
- **Historical v1 Legacy Audits:** 207 (181 carried forward, 26 sunset)
- **Sunset Dossiers Preserved:** 27 under `docs/evidence/sunset/`
- **Merged Dossiers Preserved:** 42 under `docs/evidence/merged/`

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

The full structured dataset with per-audit metadata, evidence grades, scoring tiers, weights, required evidence keys, and legacy v1 mappings is maintained in [`audit-map.json`](./audit-map.json).

To rebuild or validate the map:
```bash
pnpm build:audit-map    # Rebuilds audit-map.json from codebase state
pnpm check:audit-map    # Validates audit-map.json against code and disk
```
