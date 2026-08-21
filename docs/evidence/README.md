# Evidence

Agent Lighthouse scores websites on AI-agent readiness. Every audit here must earn its score weight with proof. This directory is that proof.

| Document | What it holds |
| :------- | :------------ |
| [POLICY.md](./POLICY.md) | The grading rubric (A–D) and what each grade may contribute to a score |
| [audits/](./audits/README.md) | One dossier per v1 audit (207; 18 since removed — see ../sunset/): what it checks, code-review findings, graded evidence with sources, disposition |
| [deletions/](./deletions/README.md) | Adversarial redemption research on the 32 delete candidates — final dispositions |
| [sunset/](./sunset/README.md) | The 18 audits removed in v2 with the proof each signal is not a factor: rationale + full dossiers |
| [proposals/](./proposals/README.md) | 83 proposed new checks with evidence dossiers |
| [sources.json](./sources.json) | The single source registry (647 entries) every dossier cites — URLs verified at research time |

## How this was produced

- 2026-08-20 — 11-agent code review of all 207 audits; 12-domain evidence research (400 sources, 174 graded signals); 10-agent novel-checks research (83 proposals).
- 2026-08-21 — 8-agent adversarial redemption research on the 32 delete candidates; user review accepted all verdicts; per-audit dossiers generated for every shipped audit.
