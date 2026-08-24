# Evidence rework and tier corrections — implementation plan

**Spec:** [`docs/superpowers/specs/2026-08-24-evidence-public-surface-design.md`](../specs/2026-08-24-evidence-public-surface-design.md)
**Sweep results:** [`docs/evidence/CONTRADICTION-SWEEP.md`](../../evidence/CONTRADICTION-SWEEP.md)
**Branch:** `feat/site-and-evidence-sweep`

Two bodies of work, in this order. Part 1 corrects audits whose tier or pass rule outruns their evidence. Part 2 rebuilds what the audit pages publish. Part 1 gates Part 2: a page that prints an audit's own "Recommended tier: informative" beside a scored weight refutes itself, so the mismatches must be gone before the pages ship.

## Global constraints

- All code comments, JSDoc and inline config comments in English.
- oxlint only. Lint with `rtk err pnpm lint`; never bare `pnpm lint`, which a local hook rewrites into an ESLint wrapper that fails on this repo. Never add `// eslint-disable-*`.
- Tier is derived from grade: `weight: weightForGrade(grade, tier)`. A registry invariant in `packages/core/src/audits/sunset.test.ts:86` requires `scoreDisplayMode: 'informative'` on every non-scored tier. Change grade, tier, weight and display mode together or the suite fails.
- Every audit change needs its dossier updated in the same commit, and a changeset. Tier and pass-rule changes are `major` — they move every scanned site's score.
- `docs/evidence/` is written only where a task says so. Dossier prose is the evidence record; do not rewrite history, append a dated section.
- `packages/core/src/audits/access-crawl-control/_robots-consumers.differential.test.ts` pins the full observable output of every robots consumer across 20 fixtures. Regenerate with `AL_REGEN_BASELINE=1`, then copy the changed audit's rows into the inline `BASELINE` and record what moved in the comment above it. Never regenerate the whole table silently.
- Gates for every task: `AL_SKIP_NETWORK=1 pnpm test`, `pnpm typecheck`, `rtk err pnpm lint`, `node scripts/check-dossiers.mjs` (must stay 215 audits / 215 dossiers).
- Do not push without asking. Do not publish to npm. Release PR #14 is on hold.

## State on entry

Registry: 215 audits — tier `scored` 167, `informative` 45, `experimental` 3; grade A 94, B 78, C 42, D 1.

Done already, committed on the branch:

| commit | what |
| :--- | :--- |
| `6487d55` | the sweep report — 16 audits, two defect classes |
| `6a23f77` | `chatgpt-user` and `ai-catalog-exists` dropped A/scored → C/informative |
| `7be6001` | `agent-governance` pass rule narrowed to the blanket-block case |
| `6e24c04`, `bd83c5c` | the public-surface design and its correction after prototyping |

## Part 1 — Class B: pass rules the cited evidence does not support

Five remain. Each is one task: read the dossier's own `**Counter-evidence:**`, narrow the rule to what the sources support, update tests, append a dated `## Pass-rule correction` section to the dossier, write a changeset.

### Task 1: `content-extraction/markdown-alternate`

Grade A, scored, weight 1.0. Its evidence grades the mechanism A **for interactive coding agents** and records that the grade does not extend to crawlers or consumer chat: ChatGPT-User takes markdown on 0.1% of fetches; a 14-day controlled test found 0 crawler visits and 0 citations for `.md` against 137 to matched HTML; Google states markdown is not needed for Search or its AI features. The audit applies the rule to every site.

Two sub-claims are separately graded and must not be merged: `rel="alternate" type="text/markdown"` has documented consumers (Claude Code, Cursor, Copilot, Codex CLI); `rel="describedby"` → llms.txt has **none-known**. Recommended tiers on the two signals are `experimental` and `scored`.

Expected shape: keep the documented half scored, drop or gate the undocumented half, and stop firing at sites with no coding-agent audience. Decide whether the gate is page-type, site-type, or a narrowed pass condition — the dossier's own consumer list is the input.

### Task 2: `access-crawl-control/meta-external-agent`

Grade A, scored, weight 1.0. One pass-rule marker in its evidence. Read it, narrow, test.

### Task 3: `content-extraction/image-alt-text`

Grade A, scored, weight 1.0. One pass-rule marker. Read it, narrow, test.

### Task 4: `answer-readiness/review-signals`

Grade B, scored, weight 0.6. One pass-rule marker. Read it, narrow, test.

### Task 5: `agent-interfaces/mcp-discovery` — pass rule

Deferred into Task 6, which restructures the same audit. Do not fix the rule twice.

## Part 2 — Class A: tiers above their own researched recommendation

Seven audits remain, each a composite carrying at least one signal the research recommends scoring. Blanket-demoting them would discard sound signals — the mistake the sweep exists to fix, in reverse. Each needs the same judgement: split the sound signal out, or narrow the audit to it.

### Task 6: split `agent-interfaces/mcp-discovery`

Five researched signals: four record `Consumers: none-known` and recommend `informative` or `delete`; one — RFC 9727 linkset validation, `Consumers: all clients following RFC 8615 well-known conventions` — recommends `scored`.

Split the RFC 9727 linkset validation into its own audit with its own id, dossier and tests, at the grade its research supports. Drop the four discovery-path checks to informative. This is a new audit file, a new dossier, registry index changes, and `NEW_IN_V2` may need the new id. `check-dossiers` must still balance.

Also fold in the Class B pass-rule marker recorded against this audit.

### Tasks 7-12: the remaining six composites

One task each, same judgement as Task 6 — split the sound signal, or narrow the audit to it, then set grade, tier, weight and display mode together.

| audit | grade/tier/weight | signals |
| :--- | :--- | :--- |
| `access-crawl-control/anthropic-ai` | A / scored / 1.0 | scored, informative |
| `answer-readiness/trust-signals` | B / scored / 0.6 | scored, informative |
| `agent-interfaces/agents-json` | C / informative / 0 | delete, scored |
| `agent-interfaces/webmcp-registered-tools` | B / experimental / 0 | delete, scored |
| `operability-safety/security-header-hygiene` | B / informative / 0 | delete, scored, informative |
| `content-extraction/markdown-alternate` | A / scored / 1.0 | done in Task 1 |

### Task 13: llms.txt re-research

Three audits are held pending fresh evidence: `machine-discovery/llms-txt-exists` (A, scored, 1.0), `machine-discovery/llms-txt-links-valid` (B, scored, 0.6), `machine-discovery/llms-full-txt` (C, informative, 0).

`POLICY.md` uses llms.txt as its worked example of grade **C** — "published widely, no documented consumer, Google states Search ignores it" — while `llms-txt-exists` ships grade A. One of the two is wrong. The user's decision was to re-research before re-tiering, not to demote on the policy text alone.

Research question: has any AI vendor documented a consumer of `/llms.txt` since the policy example was written? Primary sources only — vendor documentation or a ratified specification. Then either re-grade the three audits or correct the policy example, and say which in the dossier.

## Part 3 — the public surface

Only after Parts 1 and 2. Streams as specified in the design doc, which was corrected on 2026-08-24 after prototyping against a real file — read it before starting, the label-aware slicing is not what the first draft said.

### Task 14: the slicer and the page contract

Label-aware whitelist, supersede rule for duplicate normalised sections, regenerated intro strip from registry metadata, the two frontmatter override keys, build-time validation of `evidence_grade`. Website package and content config only; no dossier changes.

Measured target on the prototype file `access-crawl-control/agent-governance.md`: 661 of 1600 words publish across 3 sections; 939 words withheld across 4.

### Task 15: heading and label normalisation

Bring the corpus onto the whitelist vocabulary so the list stays short. Mechanical and scriptable; land as one reviewable diff.

### Task 16: close the evidence gaps

76 dossiers lack written grade reasoning, 5 cite no authority URL, 8 carry no mechanism statement, 157 lack `(verified <date>)` stamps. Where a justification cannot be written, the grade drops and the tier follows.

### Task 17: retirement decisions

The audits whose own evidence records no known consumer. Carried from the separate audit-value review; the shortlist and the two candidate bars are in that conversation's summary, not yet written to a file.

## Sequencing

Tasks 1-4 are independent of each other. Task 6 must precede Task 5's fold-in. Task 13 is independent and can run any time. Tasks 14 and 15 are prerequisites for publishing and can run together. Task 17 gates the public launch.
