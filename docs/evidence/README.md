# Evidence

Agent Lighthouse scores websites on AI-agent readiness. Every audit here must earn its score weight with proof. This directory is that proof.

| Document                            | What it holds                                                                                                                                                                                 |
| :---------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [policy.md](./policy.md)            | The grading rubric (A–D) and what each grade may contribute to a score                                                                                                                        |
| [audits/](./audits/README.md)       | One dossier per registered audit (222): what it checks, graded evidence with sources, disposition. Indexes the legacy v1 audits, linking out to `sunset/` or `merged/` for the ones that left |
| [merged/](./merged/README.md)       | Dossiers of audits folded into another audit in v2 — kept as the record of why each signal moved                                                                                              |
| [sunset/](./sunset/README.md)       | The 26 audits removed in v2 with the proof each signal is not a factor: rationale + full dossiers                                                                                             |
| [proposals/](./proposals/README.md) | 2 unimplemented proposals; completed and retired work lives in research history                                                                                                               |
| [research/](./research/README.md)   | Tool surveys, completed proposal reviews and retired proposals                                                                                                                                |
| [sources.json](./sources.json)      | The source registry every dossier cites — URLs verified at research time; see each record for its date                                                                                        |

The generated [audit map](./audit-map.md) is the current audit inventory.
The [architecture scope review](../architecture/audits.md#2026-10-21-scope-review)
records the remaining population checks. The [browser snapshot contract](../architecture/browser-snapshots.md)
and [task server contract](../server.md) describe the implemented browser and detection work.

## How this was produced

- 2026-08-20 — 11-agent code review of all 207 audits; 12-domain evidence research (400 sources, 174 graded signals); 10-agent novel-checks research (83 proposals).
- 2026-08-21 — 8-agent adversarial redemption research on the 32 delete candidates; user review accepted all verdicts; per-audit dossiers generated for every shipped audit.
