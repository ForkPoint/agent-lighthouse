# Retirement shortlist

**Date:** 2026-08-24
**Status:** decided 2026-08-24 — **Bar 1 (narrow, 6 audits)**, retired by moving to `sunset/`.
**Plan task:** [`docs/superpowers/plans/2026-08-24-evidence-and-tiers.md`](../superpowers/plans/2026-08-24-evidence-and-tiers.md) — Part 3, Task 17.

Carried from the audit-value review that ran alongside the contradiction sweep. This file records the candidates, the two bars that were considered, and the decision taken.

## Why a retirement stream exists

The public audit pages print each audit's own recorded research. An audit whose dossier says
`Consumers: none-known` beside a scored weight refutes itself in the reader's own view. The
contradiction sweep fixes the audits where the *tier* outran the evidence. Retirement asks the next
question: where the evidence supports no tier at all, should the audit ship?

## Bar 1 — policy conflict (narrow)

Six audits. Each one's own dossier records no known consumer **and** conflicts with a position the
project has already written down in [`POLICY.md`](./POLICY.md).

| audit | ships as | note |
| :--- | :--- | :--- |
| `agent-interfaces/ai-catalog-exists` | C / informative / 0 | already dropped from A/scored in `6a23f77` |
| `agent-interfaces/ai-catalog-metadata` | B / scored / 0.6 | cites no authority URL at all |
| `agent-interfaces/ai-catalog-urls` | B / scored / 0.6 | cites no authority URL at all |
| `structured-data/speakable-schema` | A / scored / 1.0 | |
| `agent-interfaces/webmcp-registered-tools` | B / experimental / 0 | also a Class A composite — plan Task 10 |
| `agent-interfaces/webmcp-declarative-forms` | A / scored / 1.0 | |

Four of the six carry a real score weight today, and two of those carry 1.0. The contradiction sweep
did not catch them because their dossiers do not record a `Recommended tier:` line below the tier
that shipped — the conflict is with `POLICY.md`, not with the audit's own tier deliberation. That is
what makes this a separate bar rather than more of the same sweep.

Two of the six — `ai-catalog-metadata` and `ai-catalog-urls` — are also on the design doc's list of
five dossiers that cite no authority URL at all.

`webmcp-registered-tools` is on both this list and the contradiction sweep's Class A list, so
whichever bar is chosen, Task 10 and this task have to agree on its fate.

## Bar 2 — grade C and informative (wide)

The narrow bar plus every grade-C informative audit: 39 audits. The argument for it is that grade C
is defined in `POLICY.md` as a signal with no documented consumer, so a C-grade audit is by
definition publishing a page that cannot answer the reader's question. The argument against is that
several of them are cheap, harmless observations a site owner may still want reported, and that
`informative` already carries weight 0, so nothing about a site's score depends on them.

## The decision (2026-08-24)

1. **Bar 1 applies** — the six policy-conflict audits, not the wider grade-C sweep. The 39 grade-C
   informative audits stay: they already carry weight 0, so no scanned site's score depends on them,
   and a cheap observation a site owner may still want reported is not the same defect as a scored
   weight with no consumer behind it.
2. **Retired audits move to `docs/evidence/sunset/`**, the treatment the 26 v1 audits got: the audit
   leaves the registry, its dossier moves across with the rationale for the removal. The record stays
   public and auditable, which is what the design doc rests the project's credibility on.
3. Retirement is a **`major`** changeset. Removing an audit changes what a scan reports even where
   the audit carried weight 0, and four of the six carry weight today.

Registry effect: 215 audits → 209. `scripts/check-dossiers.mjs` must balance at the new count, and
the sunset index gains six entries.
