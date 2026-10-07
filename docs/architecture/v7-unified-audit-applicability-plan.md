# Agent Lighthouse 7.0.0: unified audit applicability

Status: active; implementation started. Target release: **7.0.0**.
Branch: `feat/v7-unified-audit-applicability`.
Created: 2026-10-07.
Starting commit: `dbbac4359598179c61e9a4370ecd23c82eb33b22`.

This document records the approved direction and the execution ledger. It does
not claim that planned behavior already exists. Update the ledger after each
validated slice. `docs/architecture/audits.md` remains the current runtime
contract until the corresponding implementation changes land.

## Goal

Apply a common set of page checks to every eligible page. Add checks when the
page's purpose or a present feature makes them applicable. Use evidence to
support scored findings. Do not let page order or the input path change the
judgment of the same evidence.

An audit keeps its evidence grade, tier and derived weight unless its dossier
supports a deliberate change. Page purpose selects checks; it does not multiply
their weights. An unread page proves neither a defect nor an absent feature.

## Verified starting state

The source registry contains 215 audits. Of these, 36 declare
`applicablePageTypes`; none declares `pageTypes`. The other 179 have no metadata
type gate, but may have artifact or feature preconditions in their bodies.
Membership overlaps: homepage 6, product 12, category 3, content 22. These are
metadata counts, not a completed applicability review.

Local probes established these cases:

- `single-h1`: `[good, bad]` passes; `[bad, good]` fails. Only the first page
  contributes to the verdict.
- `main-element`: the same reorder changes warning to failure. The first page
  controls the partial-coverage verdict.
- An ordinary privacy page becomes `content`. `article-schema` reports a
  failure, informative when detected and scored when declared.
- A declared matching page causes `scopeAudit` to omit detected matching pages.
- The baseline focused suite passed 229 tests across six files. It establishes
  current behavior, not acceptance of the proposed rules.

## Current owners and readers

| Concern                              | Current owner                                                    | Readers / change impact                                          |
| ------------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| Page-type scoring permission         | `docs/architecture/audits.md`, section 5.1                       | Contributor policy, runner, tests                                |
| Public page types and audit metadata | `packages/core/src/types.ts`, `schemas.ts`, `check-context.ts`   | SDK callers, CLI, MCP, report schemas                            |
| Classification                       | `packages/core/src/parser.ts` (`detectPageType`)                 | Orchestrator, public export, test fixtures                       |
| Input overrides and page reads       | `packages/core/src/orchestrator.ts`                              | `ScanOptions.pageType`, `ScanOptions.pages`, report conditions   |
| Selected pages and scoring mode      | `packages/core/src/audit-runner.ts` (`scopeAudit`, `planAudits`) | Every audit; progress, traces, skipped results                   |
| Readability requirements             | `packages/core/src/scan-evidence.ts`, runner `unmetRequirements` | Evidence gates, coverage, score suppression                      |
| Shared page judgments                | `packages/core/src/gatherers/pages.ts`                           | Individual audits; public `judgePages` and `pagesOfType` exports |
| Artifact preconditions               | Artifact gatherers, including `gatherers/openapi.ts`             | Audits importing each shared precondition                        |
| Verdicts and aggregation             | `packages/core/src/audits/**` and their dossiers                 | Results, recommendations and category scores                     |
| Score and coverage                   | `packages/core/src/scorer.ts`, `orchestrator.ts`                 | CLI, report renderers, website, MCP summary                      |
| CLI override                         | `packages/cli/src/options.ts`, `main.ts`                         | `--page-type` users                                              |
| MCP entry point                      | `packages/mcp/src/tool.ts`, `server.ts`                          | `audit_website` clients; currently URL-only                      |
| Report compatibility                 | `packages/report/src`, core schemas                              | HTML/JSON/Markdown/terminal readers and saved reports            |

Known doc drift: the architecture document describes an `allPages` view that
the current `CheckContext` does not provide. It also shows `pageTypes`, while
current registrations use `applicablePageTypes`. Reconcile these claims with
the final implementation; do not build unused mechanisms just to match prose.

## Target contract

### Scope and applicability are separate

Scope describes where a check reads:

- **Origin:** shared origin settings and artifacts. Fetch these once per scan
  or through the existing origin cache.
- **Page:** evidence from each eligible page. Path-specific access rules remain
  tied to their URL even when their source file belongs to the origin.

Applicability describes when a check can judge:

- **Common:** applies to any readable page in the supported population.
- **Purpose:** applies to a confirmed purpose, such as product, article or listing.
- **Feature:** applies when the relevant feature or artifact exists, regardless
  of the page's primary label.

Keep this model small. Use shared page selection and the existing gatherers.
Do not put a growing list of artifact predicates inside the runner. Do not add
artifact-presence `EvidenceKey`s that would distort the unread-evidence mass.

### Purpose evidence

- Introduce an unknown/general outcome. An unmatched page is not an article.
- Keep general content distinct from an article purpose. A `content` override
  alone must not require a byline, article dates or Article schema.
- Record deterministic purpose signals and their provenance. Treat URL patterns
  and weak class-name matches as hints, not scoring permission.
- A confirmed purpose uses the same audit rules whether supported by direct
  page evidence or a precise operator declaration. Preserve provenance in output.
- Keep uncertain findings visible without scoring them. A declared match must
  not suppress findings for other matching pages.
- Do not use the field under test as the sole proof of purpose. A product with
  missing Product schema must still be eligible through independent evidence.
- Define each purpose rule and its negative fixtures before enabling scored
  detection. Do not remove today's informative override ahead of this proof.

### Page judgment and coverage

- A common page audit evaluates every eligible selected page, unless its dossier
  explicitly defines a different sample. Document and expose such sampling.
- Reordering the same page set cannot change the verdict, score or selected
  failure URL. Sort diagnostic evidence where a stable representative is needed.
- An empty page set returns `notApplicable`, never a vacuous pass or a failure.
- Check readability against the actual selected pages. Readable evidence from an
  excluded page must not license judging an unread selected page of the same type.
- Aggregate per audit before applying its evidence weight once. Preserve each
  dossier's verdict rules; do not impose an arbitrary universal failure threshold.
- Report affected URLs and the assessed sample. “No matching page scanned” is not
  a claim that the whole site lacks that purpose.
- Preserve attempted-but-unread page coverage. Do not silently improve coverage
  by dropping failed page fetches from the denominator.
- Distinguish absent optional artifact, present defect, uncertain applicability,
  unread evidence and scan-budget exhaustion.
- Keep common-check coverage distinct from specialist coverage. Overall scores
  with different applicable sets are not identical measurements.

### Evidence and scoring invariants

Keep `weightForGrade`, informative/NA exclusion, unread-scan protection, URL
safety, redirect checks and the current 35% missing-evidence threshold. Re-test
the threshold with the new scope; change it only with calibration evidence.
Every audit change must agree with its dossier. New sources or grade changes
require evidence review before implementation.

## Execution stages

### P0 — Plan and branch

- Create the dedicated branch and this durable Markdown plan.
- Record the current rule owners and the migration boundary.
- Use the following stages as the completion ledger for 7.0.0.

### P1 — Common-page scope pilot

Start with `content-extraction/single-h1` and
`content-extraction/main-element`.

1. Add failing tests for later-page defects, page permutations, empty samples,
   non-homepage wording, affected URLs and schema-valid runner results.
2. Reuse `judgePages`; remove the first page's special role.
3. Keep the existing element predicates and metadata in this narrow slice.
   `single-h1` remains binary here. `main-element` passes when every page has
   `<main>`, warns on partial coverage, and fails when none has it.
4. Update both dossiers with the implemented scope and remaining limitations.
   Track duplicate-heading severity, hidden headings, ARIA main landmarks and
   multiple-main handling for P2. Do not describe those as fixed by a scope edit.
5. Add a patch changeset for the implemented verdict corrections. It belongs to
   the 7.0.0 workstream; it does not by itself implement the major migration.
6. Run focused regression proof, result contracts and the repository gates.

Exit: both audits judge the same complete sample in either order, identify
affected URLs, decline empty input, and retain their current grade/tier/weight.

### P2 — Audit-by-audit applicability ledger

Review all 215 registrations against their source and dossier. Record the audit
ID, origin/page scope, supported population, purpose/feature precondition,
absence rule, evidence read, aggregation, sample coverage, implementation gaps
and acceptance tests. Distinguish verified rows from pending review.

Start with all 36 typed audits, then first-page reads and homepage-dependent
branches in the other 179. The scope pilot does not make all common audits
consistent. Include `header-footer`, which has the same first-page branch.
Resolve the P1 semantic deferrals against the existing dossier evidence.

Exit: every registration has a reviewed row. No metadata-only inventory counts
as completion. Any unsupported population or claim has an explicit disposition.

### P3 — Purpose evidence and canonical metadata

Define the minimal purpose/evidence shape from the P2 ledger. Add the unknown
fallback and independent article evidence. Normalize the two metadata aliases
at one boundary. Keep one canonical internal representation. Define conflicting
aliases and legacy `content` semantics explicitly.

Write fixtures for privacy, contact, generic content, articles, product pages,
listings, homepages with features, weak URL matches, missing structured data,
malformed structured data and mixed signals. Test precise operator overrides.

Exit: classification has explicit evidence and uncertainty; positive and negative
fixtures pass without circular applicability.

### P4 — Runner and evidence integration

Select all eligible pages under the new contract. Preserve uncertain-page
findings alongside scored findings without double-counting the audit's weight.
Validate requirements against the selected set. Retain shared origin caches;
key page-derived caches by the actual input set where needed.

Exit: mixed provenance, page permutations, unread selected pages, missing
artifacts, failed fetches and concurrent scans pass runner-level tests. Progress
and traces account for every registration. No result schema rejection becomes
a hidden `scan-error` stub.

### P5 — Clients, reports and public contract

Align CLI, SDK and MCP behavior. Keep manual type correction explicit. Add the
agreed applicability and coverage data to schemas and reports. Handle old saved
reports without inventing missing coverage. Show uncertainty and assessed URLs.
Update architecture section 5.1, scoring docs, CLI help, website guidance and
affected dossiers. Keep section 5.2 network safety rules intact.

Exit: identical evidence through each supported input path yields the same
eligible findings and score; report tests cover old and new shapes.

### P6 — 7.0.0 release readiness

Add the major changeset when the new public semantics exist. The four published
packages form a fixed Changesets group. Use the release workflow to apply
7.0.0; do not manually stamp package versions during the incomplete migration.

Run all seven repository gates in order:

```sh
pnpm build && pnpm test && pnpm typecheck && pnpm lint && pnpm check:dossiers && pnpm check:requires && pnpm check:audit-map
```

Review saved-corpus verdict and coverage changes with per-change reasons. Run
live verification and separate network/environment failures from regressions.
If offline, record `AL_SKIP_NETWORK=1` and the exact proof still missing; do not
call that full release validation. Check CLI/MCP/report package consumers.

Exit: every stage is complete, corpus differences are explained, public migration
notes exist, and the final gate results refer to the final source tree. Commit,
push, merge and publication remain separate actions, not implied by a local plan.

## Migration and rollback

1. Land safe scope corrections first; keep today's type guard during preparation.
2. Expand internal evidence structures and compatibility readers before switching
   runtime behavior. Avoid parallel independent applicability implementations.
3. Change public type/flag/report semantics together in the 7.0.0 boundary. Keep
   intentional legacy readers for persisted reports; reject unsupported input
   clearly instead of silently reinterpreting it.
4. Keep pre-7 reports unchanged. Derived caches must not reuse incompatible
   evidence; bump a cache version if the cached shape or meaning changes.
5. Before release, rollback means reverting the new runtime slices while keeping
   the plan and regression evidence. After release, callers can pin the prior
   package set. Do not rewrite their saved reports or delete migration evidence.

## Execution ledger

| Stage | State    | Proof / remaining work                                                 |
| ----- | -------- | ---------------------------------------------------------------------- |
| P0    | Complete | Dedicated branch created; plan saved.                                  |
| P1    | Complete | Both scope corrections implemented; regression and gate results below. |
| P2    | Pending  | Counts verified; full semantic review remains.                         |
| P3    | Pending  | Current detector and type-scoring guard remain in force.               |
| P4    | Pending  | Selected-page evidence and mixed-provenance results remain.            |
| P5    | Pending  | Public shapes, clients and documentation remain.                       |
| P6    | Pending  | No 7.0.0 versioning or publication performed.                          |

## P1 execution record — 2026-10-07

Implemented in this branch:

- Both audits use `judgePages` over the complete selected sample.
- `single-h1` reports the good-page fraction and each affected page's count.
- `main-element` uses all/partial/no coverage, independent of page order.
- Both decline empty samples and use stable, sorted failure URLs.
- Findings use the existing bounded text fields; large samples keep the
  truncation marker instead of failing result-schema validation.
- Both dossiers record the correction and the outstanding semantic defects.
- `.changeset/common-page-scope-pilot.md` records the patch-sized pilot.
  The target remains 7.0.0; the major contract work is still pending.

Regression proof:

- Before implementation: 13 failures and 7 passes across the initial three
  test files. The isolated main-element order test produced
  `expected [ 'warn', 'fail', 'fail' ] to deeply equal [ 'warn', 'warn', 'warn' ]`.
- After implementation and the fixture correction: **22 tests passed** across
  those three files. Coverage includes four page types, declared/detected
  provenance, actual runner execution, empty samples, page permutations,
  unchanged input arrays, affected URLs and 150-page schema-boundary samples.

Validation:

| Command                                        | Result                                                               |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| `pnpm build`                                   | Passed; all packages, including the website.                         |
| `pnpm test`                                    | 344 files passed, 1 skipped; 5,808 tests passed, 219 skipped.        |
| `pnpm typecheck`                               | Passed after fixing the new fixture's missing `wafProtection: null`. |
| `pnpm lint`                                    | Passed.                                                              |
| `pnpm check:dossiers`                          | 215 audits and 215 dossiers agree; no orphans.                       |
| `pnpm check:requires`                          | 215 audits agree with their source reads.                            |
| `pnpm check:audit-map`                         | 215 active audits and 207 legacy mappings agree.                     |
| Targeted Prettier check and `git diff --check` | Passed.                                                              |

The first full command chain stopped at typecheck with `TS2741` because the new
test fixture omitted the required `wafProtection` field. After adding `null`,
the 22 focused tests passed and the five remaining gates completed with exit 0.
The full suite had already passed before this test-fixture-only correction;
it was not rerun. No production code changed after that full suite run.

The 219 skipped tests comprise 215 opt-in Labs checks and four verbose result
printouts. `AL_SKIP_NETWORK` was unset; the normal network verification suite
was enabled. Labs validation still requires a configured reference app.

Next: P2. Review the 36 typed audits first, then the remaining registrations.
Use the source and dossier for each ledger row. Keep P3–P6 pending until their
own acceptance conditions have proof. These two corrections do not establish
registry-wide page consistency or 7.0.0 release readiness.
