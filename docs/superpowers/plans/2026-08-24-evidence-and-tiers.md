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

**Resolved 2026-08-24 — no split was made, and none was needed.** The RFC 9727 linkset validation already ships, inside `agent-interfaces/openapi-exists`: `servedAsData()` rejects a `text/html` body at `/.well-known/api-catalog`, the linkset must parse and carry a non-empty array, and its tests pin the HTML-200 case. It was built on 2026-08-22 from the same API Evangelist survey the signal cites.

The signal describes itself as "a meta-signal about how the other audits must be implemented" — a validation rule, not an adoption claim — so implementing it once, in the audit that owns the path, discharges it. A second audit would have duplicated a live check, contradicted the tier `openapi-exists` deliberately carries (its own evidence: "informative rather than scored until a consumer is documented"), and required a pass condition under which serving `{}` at a well-known path bought a weight-1.0 win.

What landed instead: `mcp-discovery` drops to C / informative / 0, absence becomes `notApplicable`, and the two vacuous passes (`{}` at `/.well-known/ucp`, `{"servers": []}`) are removed. Registry unchanged at 215. Whether `/.well-known/api-catalog` has since acquired a documented consumer is folded into Task 13.

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

Folded in on 2026-08-24, from Task 6: ask the same question of `/.well-known/api-catalog`. `agent-interfaces/openapi-exists` ships it at B / informative / 0 on the recorded reasoning "informative rather than scored until a consumer is documented". If a consumer has since been documented, that tier moves with llms.txt's.

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

The audits whose own evidence records no known consumer. Carried from the separate audit-value review. The shortlist, the two candidate bars and the decision are now recorded in [`docs/evidence/RETIREMENT-SHORTLIST.md`](../../evidence/RETIREMENT-SHORTLIST.md).

Decided 2026-08-24: the **narrow bar** — six audits, `agent-interfaces/ai-catalog-exists`, `ai-catalog-metadata`, `ai-catalog-urls`, `structured-data/speakable-schema`, `agent-interfaces/webmcp-registered-tools` and `webmcp-declarative-forms`. The 39 grade-C informative audits stay. Retirement means moving the audit out of the registry and its dossier into `docs/evidence/sunset/`, as the 26 v1 audits were, not deleting either. `major` changeset. Registry 215 → 209, and `check-dossiers` must balance at the new count.

This decision overtakes Task 10: `agent-interfaces/webmcp-registered-tools` retires, so it is not split or re-tiered. Fold it into this task.

**What landed (2026-08-24): nothing retires. Two audits re-graded instead.**

Before executing, each of the six was checked against the shipped code and its current dossier rather than the shortlist note. **None still meets the bar.** The shortlist was built from the redemption dossiers under `docs/evidence/deletions/`, which describe the audits *before* the Plan 4 rework of 2026-08-22 — and all six were rebuilt in that pass. Each now names a documented consumer: ARD plus `huggingface/hf-discover` for the three `ai-catalog` audits (both re-verified live on 2026-08-24), a live Google Search Central page for `speakable-schema`, a live Chrome declarative-API page for `webmcp-declarative-forms`. The policy conflict behind the three `ai-catalog` entries also disappeared when Task 13 corrected `POLICY.md`'s grade-D row on the same day. The per-audit findings are in [`RETIREMENT-SHORTLIST.md`](../../evidence/RETIREMENT-SHORTLIST.md#re-verification-2026-08-24).

Two findings survived the check, and the user chose to act on them: `structured-data/speakable-schema` and `agent-interfaces/webmcp-declarative-forms` both scored at grade **A**, weight **1.0**, on features their own vendors label provisional — Google says speakable is "in beta and subject to change" and scopes it to U.S. English news publishers; Chrome's declarative WebMCP page carries an origin-trial badge and says the API is "under active discussion". Both are re-graded **A → B**, weight 1.0 → 0.6. Registry stays at 215; mass 134.8 → 134.0.

`agent-interfaces/webmcp-registered-tools` does **not** retire, so Task 10 came back on. It was then checked and closed the same day — see below.

### Task 10: `agent-interfaces/webmcp-registered-tools`

**What landed (2026-08-24): no split, no tier change.** Like Task 6, the premise was already discharged by the Plan 4 rework of 2026-08-22.

The audit's two disagreeing signals no longer both apply to it. The grade-D `webmcp-well-known-manifest` signal (`Recommended tier: delete`) was deleted with its code: the `/.well-known/webmcp` check is gone, the path was removed from the orchestrator's `rootFilePaths`, and two tests pin that a manifest there cannot pass and that the path appears nowhere in the audit's copy. The grade-A `agent-surface-soft-404-validation` signal (`Recommended tier: scored`) is the same meta-rule Task 6 resolved — validate content-type and parseability on any well-known path an audit reads — and this audit reads none; it matches `navigator.modelContext` in inline scripts. The rule ships in `agent-interfaces/openapi-exists`.

What is left is one mechanism, correctly priced: Lighthouse 13.3+ reads `navigator.modelContext` from an instrumented browser, this scanner has no JS runtime and cannot distinguish "no tools" from "cannot see the tools", so B / `experimental` / weight 0. `packages/core/src/audits/REWORK-TODO.md` reached the same conclusion on 2026-08-22.

## Sequencing

Tasks 1-4 are independent of each other. Task 6 must precede Task 5's fold-in. Task 13 is independent and can run any time. Tasks 14 and 15 are prerequisites for publishing and can run together. Task 17 gated the public launch and is now closed: nothing retires, two audits re-graded. Task 10 is closed too: checked, no split needed.
