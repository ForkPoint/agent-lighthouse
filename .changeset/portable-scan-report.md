---
"@forkpoint/agent-lighthouse-core": minor
"@forkpoint/agent-lighthouse-report": minor
"@forkpoint/agent-lighthouse": minor
---

Add compact and portable scan reports via `toPortableReport`, `hydratePortableReport`, and the CLI `--output portable` format.

- Omits static registry prose (descriptions, titles, guidance impact, guidance fix, docs URLs, evidence URLs) and derived macro aggregations (categories, top passes/fails, recommendations, summaries, readiness vitals) to reduce report payloads by 80–90% while retaining full fidelity.
- Rehydrates losslessly against the engine/report version registry and scoring laws.
- `hydrateReport` in `@forkpoint/agent-lighthouse-report` now seamlessly accepts both `PersistedScanRow` and `PortableScanReport`.
