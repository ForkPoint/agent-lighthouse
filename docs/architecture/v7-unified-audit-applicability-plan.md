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

| Stage | State    | Proof / remaining work                                                                                           |
| ----- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| P0    | Complete | Dedicated branch created; plan saved.                                                                            |
| P1    | Complete | Both scope corrections implemented; regression and gate results below.                                           |
| P2    | Done     | All 215 source/dossier reviews recorded. Scope corrections have regression proof; other gaps remain explicit.    |
| P3    | Complete | Purpose evidence, article/general split, alias normalization, CLI and report compatibility pass.                 |
| P4    | Complete | Selected-page evidence, advisory populations, failed-fetch coverage, cache and progress proofs pass.             |
| P5    | Complete | Client parity, report scope, saved-report compatibility, browser checks and seven gates pass.                    |
| P6    | Complete | Local corpus review, live verification, package consumers and final gates pass. Release actions remain separate. |

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

## P2 execution record — 2026-10-07

The [applicability ledger](v7-audit-applicability-ledger.md) records source and
dossier review for all 36 typed audits and the three common landmark/heading
audits. It separates present behavior, proposed applicability, aggregation,
absence, coverage gaps and acceptance tests. The remaining 176 registrations
still need source-and-dossier review. This is not a complete P2 or a fresh
verification of every external consumer.

The review found that the article helpers in several audits accept any non-XML
HTML, that several sample-wide passes depend on one page or one entity, and that
news, English-homepage and commerce-feed populations need narrower scope than
generic `content` or `product`. The ledger also records the dossier-backed
direction for the P1 semantic deferrals; their implementation remains open.

The `header-footer` scope correction now uses the same selected-page rules as
the main-element pilot. It declines empty samples, reports each missing
landmark by URL and gives the same verdict in any page order. Literal element
predicates remain unchanged; the dossier records their outstanding defects.
`.changeset/header-footer-page-scope.md` records this patch-sized correction.

Regression proof: 12 tests failed and six passed before the fix. Reordering
returned `[warn, fail, fail]` rather than `[warn, warn, warn]`. Empty input
returned `pass` rather than `na`. After the fix, **30 tests passed across four
files**, including the existing heading/main checks, all four page types,
both provenance values, actual runner output and 150-page result bounds.

Validation for the current slice completed with exit 0 through all seven gates,
in order: `pnpm build`, `pnpm test`, `pnpm typecheck`, `pnpm lint`,
`pnpm check:dossiers`, `pnpm check:requires`, `pnpm check:audit-map`.

- Full suite: **344 files passed, one skipped; 5,812 tests passed, 219 skipped**.
- `AL_SKIP_NETWORK` was unset; normal live-site verification ran. Opt-in Labs
  checks and verbose printouts remain skipped as described in the P1 record.
- Dossiers and requirements: 215 audits agree. Audit map: 215 active audits
  and 207 legacy mappings agree.
- Targeted Prettier check and `git diff --check` passed.
- The source-registry ledger check confirmed 39 unique reviewed IDs, all 36
  typed registrations included, 176 pending, and all source/test/dossier paths
  present. This proves membership, not completion of the pending semantic fixes.

Local gate log: `/tmp/agent-lighthouse-v7-p2-gates.log`. No source or test code
changed after the gate run; subsequent edits only record these results. This
slice remains local and uncommitted. It adds no package version or release.

## P2 second review slice — 2026-10-07

The applicability ledger now covers **83 registrations**. This slice reviewed
the remaining 20 content-extraction audits and all 24 machine-discovery audits.
Together with the initial typed review, all content-extraction and
machine-discovery registrations now have a source-and-dossier row. **132
registrations remain pending.** No external consumer re-verification or grade
change is implied by this local review.

Key design constraints from this pass:

- Entry-page token/extractor measurements are explicit dossier limits. They
  need stable entry identity and truthful coverage, not an automatic expansion
  to every page.
- Root artifacts and mounted-site indexes need separate scope from page
  purposes. Optional-file guards remain beside the read in shared gatherers.
- Shared hydration state merged payloads from different pages by name. The
  correction below applies the single-payload ceiling within a page; aggregate
  ratio/duplication semantics remain open.
- The sequential-heading dossier explicitly declines evidence for a skipped-level
  penalty. Its current scored implementation needs a grade/tier decision before
  the major release, not a broader page-type gate.
- Feed/site freshness comparisons must cover the same content population.
  A newer product page does not establish a stale blog feed.
- Probe failures and bounded samples cannot support “all links work” or
  “both negative probes succeeded” when the relevant reads did not complete.

Implemented `language-attribute` scope correction:

- Every selected page contributes to the binary presence verdict.
- Empty samples return `notApplicable`; missing/blank values fail with sorted
  affected URLs and bounded result text.
- Different page languages are accepted. This change does not introduce
  BCP 47 validation or require language agreement across a multilingual site.
- The body-readability exemption remains intact and has actual runner tests.
- Audit text now describes the dossier's accessibility/i18n consumer path,
  without the unsupported model/tokenizer-selection claim.
- `.changeset/language-attribute-page-scope.md` records a patch-sized correction.

Regression proof: **12 failures, seven passes** before implementation across
the language and common-page-scope files. After correction and two shell runner
tests, all **21 focused tests** passed. The seven-gate chain then passed with
**5,817 tests passed, 219 skipped** in
`/tmp/agent-lighthouse-v7-p2-language-gates.log`.

The same review then isolated a second scope correction in
`hydration-payload-share`. Each of two approximately 70 kB payloads passed
alone. Together they failed as one 140 kB payload. Three regression cases failed
before the fix; 11 existing cases passed. The named-payload map now belongs to
one page. Same-page chunks still combine, and size ties select stable URLs.
The existing total-share and duplication aggregates remain open in the ledger.
`.changeset/hydration-payload-page-boundary.md` records the patch.

Final validation after the hydration correction:

- **54 focused tests passed** across six files, including the previous
  main/heading/header checks, actual runner language checks and payload isolation.
- All seven gates completed in order with exit 0: build, test, typecheck, lint,
  dossiers, requirements and audit map. Log:
  `/tmp/agent-lighthouse-v7-p2-final-gates.log`.
- Full suite: **344 files passed, one skipped; 5,820 tests passed, 219 skipped**.
  `AL_SKIP_NETWORK` was unset. Labs remained unconfigured; the skips comprise
  the 215 opt-in Labs checks and four verbose result printouts.
- 215 dossiers and declared requirements agree with source. The audit map
  retains 215 active audits and 207 legacy mappings.
- The source-registry ledger check confirms 83 unique reviewed IDs, all 36
  typed audits, both complete category sets, 132 pending registrations and
  existing source/test/dossier paths for every reviewed ID.
- Targeted Prettier checks and `git diff --check` passed. No source or tests
  changed after the final gate run; subsequent edits only record this proof.

No package version changed. These additions remain local and uncommitted.

Next at the end of this slice: continue the 132 pending registrations, starting
with first-page and homepage-dependent bodies. Keep P3–P6 pending until their own acceptance
conditions have proof. These corrections do not establish registry-wide page
consistency or 7.0.0 release readiness.

## P2 third review slice — 2026-10-07

The ledger now covers **144 of 215 registrations**. This pass adds all 37
access-crawl-control audits and all 24 agent-interfaces audits. **71 remain**:
four structured-data, 19 answer-readiness, three agentic-commerce and 45
operability-safety audits. All 36 typed registrations and four complete
categories have review rows. A source-registry check found no duplicate IDs,
missing required rows or missing source/test/dossier files. This remains a local
source-and-dossier review, not fresh external verification or proof that every
reviewed audit is correct.

Key constraints from this pass:

- Origin robots policy at `/` must not imply access to every selected page.
  Keep usage-control tokens separate from real fetch-probe identities.
- Page response headers and inline licenses must retain their resource scope.
  Opposite policies on different pages do not establish a contradiction.
- MCP, search, catalog and WebMCP applicability must follow observed adoption.
  One adopted form must not require unrelated forms to expose tools.
- MCP discovery and listing use shared readers. First-source selection,
  server-card versus endpoint identity, partial lists and unread probes need
  explicit handling before their consumers claim complete coverage.
- `mcp-registry-listing-ownership` admits unrelated material in its Evidence
  block. Its consumer penalty and optional-adoption rule need evidence review
  before the 7.0.0 scoring decision. No grade or tier changed in this slice.

Implemented the narrow `no-nofollow` page-scope correction:

- Empty selected-page samples return `notApplicable`.
- Both warn and fail report a stable, sorted sample of affected URLs.
- Long URL evidence uses existing result bounds.
- The title and guidance now describe page directives and the dossier's
  Applebot consumer path. They no longer claim to inspect individual anchors
  or prove that all linked pages are invisible to every AI crawler.
- The body-readability exemption still works through the runner on all four
  page types with both declared and detected provenance.
- The dossier records unchanged predicate limits: substring matching, `none`,
  named-bot scope and utility-page exemptions still require separate work.
- `.changeset/nofollow-page-scope.md` records this patch-sized correction.

Regression proof: **12 failures and seven passes** before implementation;
**19 passes** after the correction. The focused audit, common-page and hostile
scan-state suites then passed **405 tests across three files**. The eight new
runner cases initially failed only the missing affected-URL evidence assertion;
they already reached the audit and preserved its scored weight.

Validation completed for the code change:

- Build, full tests, typecheck, lint, dossiers and requirements passed in order.
- Full suite: **344 files passed, one skipped; 5,831 tests passed, 219 skipped**.
  `AL_SKIP_NETWORK` was unset. The skip set remains the opt-in Labs checks and
  verbose printouts described above.
- The final gate first failed with `audit-map.json is out of date.` The new
  title required a generated-map update. `pnpm build:audit-map` synchronized
  the map; `pnpm check:audit-map` then passed with 215 active audits and 207
  legacy mappings. Only the nofollow title changed in the generated output.
- Log of the initial seven-gate sequence:
  `/tmp/agent-lighthouse-v7-p2-access-interface-gates.log`. Its final exit is 1;
  the subsequent map rebuild and check completed separately with exit 0.
- No source or test code changed after that validation. Later edits only
  complete the review ledger and record evidence.

No package version changed. The changes remain local and uncommitted.

## P2 completion — 2026-10-07

The final pass adds the remaining **71** source/dossier rows: four structured-data,
19 answer-readiness, three agentic-commerce and 45 operability-safety audits.
The ledger now covers **215 of 215** registrations. A source-registry check
confirmed 215 unique IDs, zero pending IDs, all 36 typed registrations and
existing source/test/dossier files for every row.

The accessibility wrappers were traced through their shared implementation,
static HTML runner and element-match rules. Missing engine output can appear as
inapplicability; a passing page can hide another incomplete result. These are
coverage concerns for P4, not reasons to require an ARIA feature on every page.

Other decisions from the final pass:

- Article/retrieval heuristics do not apply to every general, utility or app page.
- First-page limits explicitly documented in a dossier need either stable entry
  identity or a reviewed aggregation change. A broad loop alone is not sufficient.
- ACP obligations need commerce/protocol evidence. Ordinary links and arbitrary
  selected pages cannot establish merchant or product purpose.
- Resource policies must remain attached to their resources. Pooled CSP and
  script data can combine facts from different pages into a false failure.
- Optional provenance/identity checks must grade actual declarations. Unread
  registries and partial media samples cannot prove absence or verification.
- Static security pattern checks must describe observed patterns and their limits.
  They do not prove server effects, attacker intent or successful exploitation.

P2 meets its review exit condition. Its rows retain explicit dispositions for
unsupported populations and claims. This is not completion of every proposed
predicate fix, fresh validation of every external source, or release readiness.

Next: P3. Add unknown/general classification and independent article-purpose
signals. Define precise overrides and one internal applicability representation.
Keep the current informative guard until its positive and negative fixtures pass.
P4–P6 remain pending. The release target remains **7.0.0**.

### P3 execution — page-purpose contract (2026-10-07)

The local implementation adds `article` and `unknown` to `PageType`. The classifier
returns `{ type, source, confidence, signals }`. Page contexts, scanned-page entries,
and target conditions preserve that evidence. Root and mounted homepage identity
no longer depends on whether the page appears first. URL and schema matches remain
hints. Conflicting strong article/product signals return unknown purpose.

An article can qualify through Open Graph article metadata or one visible primary
article with a heading and at least two prose paragraphs (200 characters total).
It need not carry Article schema, author metadata, or dates. This is a conservative
heuristic, not a proof of editorial purpose. Hidden article blocks and hidden
paragraphs cannot establish that prose signal. Schema-only article matches remain
hints; nested related entities do not establish page purpose.

Legacy `content` declarations remain valid input and normalize to `unknown` at
`runScan`. A caller must declare `article` to request scored article obligations.
Old saved conditions still parse without new evidence fields. New reports preserve
the declaration in `signals`, including `declared:content`. The public
`detectPageType` wrapper retains its call shape but now returns the new vocabulary.
Custom audits that intend general-page coverage must add `unknown` to their
metadata; `content` remains available for older manually constructed contexts.

The runner copies and normalizes audit metadata to `applicablePageTypes`. It accepts
`pageTypes` as a legacy alias and rejects unequal sets, even if one is empty. Equal
sets ignore order and duplicates. No aliases or two empty sets mean universal scope.
Configuration errors remain errors even on unread scans. Caller config and registry
metadata are not mutated.

Twelve article obligations now select `article`: article-element, article-schema,
author-schema, speakable-schema, meta-author, named-author, author-page,
author-same-as, publication-date, last-modified-schema, dates-on-content, and
first-paragraph-answers. Ten other typed checks add `article` and `unknown` to
preserve their former general-content population. The 22 dossiers record those
changes and retain their open body-level work. No audit ID, grade, tier, or weight
changes in P3. The fixed package group has a major changeset for the new contract;
package versions remain release-workflow owned.

Regression proof started with 16 failing cases before implementation. New fixtures
cover general pages, article cards, articles without schema/author/dates, products
without schema, listings with buy controls, homepage features, weak URLs, malformed
JSON-LD, hidden prose, conflicting signals, overrides, alias conflicts, and old
conditions. Full `runScan` tests prove that all 12 article obligations skip general
pages and that missing Article schema remains a visible finding on articles.
Detected matches remain informative; precise article declarations use the audit's
existing display mode. Common-page tests include both new labels.

#### P3 limits and next work

Signal strength is diagnostic in this phase. P4 must change selected-page evidence
and mixed-provenance execution before any broader scoring claim. The current runner
still selects declared matches ahead of detected matches. Specialist body guards,
including speakable's narrower news/language population, remain ledger work. P5
still owns full report coverage and client controls, including MCP override support.
P6 still owns the corpus comparison and release-readiness proof.

Rollback before release: revert the P3 source, metadata, schema, help, dossier, and
changeset edits together. Do not rewrite stored reports. No storage migration or
live-site mutation is involved. Preserve the independent P1/P2 corrections.

#### P3 validation

- Final build: `pnpm build`, exit 0 (`/tmp/al-v7-p3-final-build.log`).
- Final full suite: `pnpm test`, 345 files passed, 1 skipped; 5,883 tests passed,
  219 skipped; exit 0 (`/tmp/al-v7-p3-final-test.log`). `AL_SKIP_NETWORK` was not set.
- Focused parser, runner, orchestrator, common-page, and purpose regressions:
  287 passed (`/tmp/al-v7-p3-final-focused.log`).
- CLI input, saved conditions, metadata, and legacy compatibility run: 161 passed
  (`/tmp/al-v7-p3-contract-tests.log`).
- `pnpm typecheck`: exit 0. Astro checked 77 files with 0 errors, 0 warnings,
  and 0 hints (`/tmp/al-v7-p3-final-typecheck.log`).
- `pnpm lint`, `pnpm check:dossiers`, `pnpm check:requires`, and
  `pnpm check:audit-map`: exit 0. The checks cover 215 active audits and
  207 legacy mappings. The additional audit-boundary check also passed.
- Prettier on all changed/new Markdown, TypeScript, and JSON files passed.
  `git diff --check` passed.
- `pnpm changeset status --output=/tmp/al-v7-p3-release-plan.json`: exit 0;
  all four public packages plan a major bump from 6.0.0 to 7.0.0. No package
  version command, commit, push, or publication ran.

The first full run failed on four old metadata/condition expectations. Those tests
now assert the new contract. Its log remains `/tmp/al-v7-p3-test.log`; it is not
reported as a passing run. The first all-package typecheck found TS2835 in the new
test's dynamic import. A static import fixed it before final validation.

P3 meets its local exit condition. Next: P4 selected-page evidence and mixed
provenance. P4–P6 remain pending; this is not 7.0.0 release readiness.

### Central audit index — user-requested follow-up (2026-10-07)

Extended `docs/evidence/audit-map.json` to format version 5 without changing audit
behavior. All 215 active records now carry declared purpose, feature tags, current
page-type scope, default participation, priority, and source/test pointers. Existing
evidence, scoring, and lifecycle fields remain. All 215 records link to their P2
review snapshot; baseline observations, proposed work, and acceptance criteria are
explicitly separate from current metadata and execution proof. The reading guide
explains these limits. The generated Markdown guide includes small `jq` queries.

The generator reuses the runner's alias resolver and rejects conflicting scope,
missing metadata, duplicate IDs/reviews, and missing implementation/test/dossier
paths. The existing CI `check:audit-map` step detects stale generated fields.
Future audits without a P2 review remain explicit as `review: null` and appear in
`summary.auditsWithoutReview`; the index does not invent a review for them.

Proof: the new index assertions first failed on four missing fields/contracts.
The stale-output check also failed before regeneration. After generation, 76
focused index/lifecycle tests passed. Full typecheck, lint, audit-map validation,
format checks, and `git diff --check` passed. Typecheck initially found TS6059 when
the generator test lived under core; moving it beside the script and including
script tests in the root Vitest config resolved the package-boundary error.

No runtime audit source changed in this follow-up. The earlier full P3 suite remains
the runtime proof; it was not rerun for this documentation/generator-only change.
P4–P6 remain pending. Changes are local and uncommitted.

### P4 execution — selected-page evidence and mixed populations (2026-10-07)

`planAudits` now builds separate primary and advisory executions for a typed audit.
Declared matches retain the primary result. Detected matches run even when a declared
match exists and remain informative under `advisoryResults`. Detected-only scans keep
one informative primary result. Universal audits keep one combined population. Input
sets use a stable URL order. Each population gets a fresh audit instance; static
metadata and caller context are not mutated by the runner.

The scorer sees one top-level result and applies the audit weight at most once.
A gated declared population cannot acquire a scored verdict from a readable detected
population. Each execution receives page evidence restricted to its own URLs.
Content requirements remove unread pages from verdict inputs; coverage retains them.
Origin evidence and header/body exemptions remain intact. The global unread-site guard
still prevents any audit verdict when the scan could not read the site.

The new optional `coverage` field names provenance, selected URLs, input URLs, and
unread URLs. The orchestrator records every requested page in `pageAttempts`, including
failed declared URLs that parsing omits from `pagesScanned`. Unclassified failures
remain unknown and cannot invent specialist purpose. Input coverage is not proof that
an individual audit body inspected every supplied page; body-level sample corrections
remain in the applicability ledger.

Progress and traces now account for every registration once, including skipped
registrations. Traces retain advisory findings and their coverage. A schema error,
missing evidence, or exhausted budget in one population does not erase a completed
result from another. Full result validation preserves weight and accepts the optional
`details.effort` emitted by the base audit converter. Advisory schema validation requires
informative display mode. Older reports need not invent coverage or advisory fields.

Gatherer review found origin caches and URL-keyed fetch caches, not whole-selected-set
caches requiring replacement. Scoped contexts retain the scan's cache owner. Feed
selection reads each scoped page set anew; shared URL probes still fetch once within
a scan. A concurrent two-scan regression proves separate cache ownership.

#### P4 proof

- Four regressions failed before implementation: suppressed advisory findings,
  borrowed readability, unread verdict inputs, and page-order differences.
- Full scan tests prove failed declared fetch coverage and 215 distinct results,
  traces, and progress events with both declared and detected article pages.
- `pnpm build`: exit 0, `/tmp/al-v7-p4-build.log`.
- `pnpm test`: 347 files passed, 1 skipped; 5,908 tests passed, 219 skipped; exit 0,
  `/tmp/al-v7-p4-full-second.log`. Network tests remained enabled.
- Two later boundary tests cover scoped body guards and concurrent scoring modes.
  The subsequent focused runner/orchestrator/index suite passed all 119 tests:
  `/tmp/al-v7-p4-last-focused.log`. No runtime code changed after the full passing run.
- `pnpm typecheck`: exit 0; Astro 77 files, 0 errors/warnings/hints.
- `pnpm lint`, `pnpm check:dossiers`, `pnpm check:requires`, and
  `pnpm check:audit-map`: exit 0. The central index retains all 215 audits and
  207 legacy mappings and now describes advisory scoring.
- Targeted Prettier checks and `git diff --check` passed. The staged index hash
  matches the pre-P4 snapshot; this stage adds only working-tree changes.

The first full run failed on two server-rendered assertions. Scoping had populated
per-URL measurements from the synthetic `allEvidenceMet()` flags. The fix preserves
missing measurements so the audit can use its actual DOM fallback. Both corpus and
live-site regressions pass in the final full run. Initial new test fixtures also
needed the correct OpenApiServersAudit name and ScanOptions.onAuditTrace callback;
final typecheck passes. Logs retain the failed runs; they are not counted as successes.

#### P4 limits and rollback

Detection confidence remains diagnostic. This stage does not grant scoring authority
to heuristic type detection. P5 must expose coverage and advisory results in human
reports and align client controls; core results and traces now carry the data. P6
still owns live-corpus comparison and release-readiness proof. No 7.0.0 release ran.

A dedicated major changeset records the result and progress contract changes. Before
release, rollback means reverting the P4 runner/evidence/schema/trace/orchestrator slice
and its documentation together while preserving P1–P3 and the central index. Stored
reports require no migration or rewrite. No commit, staging, push, or publication ran.

## P5 execution record — 2026-10-07

Implemented on the v7 branch:

- SDK, CLI JSON config, MCP tool, and MCP programmatic helper share manual
  `pageType` and `pages` validation. The CLI flag overrides its config declaration.
  Target declarations take precedence over a matching `pages` entry. Invalid types,
  bare CLI declarations, and malformed override URLs fail before fetching. The
  SDK previously skipped malformed override URLs; v7 now reports them explicitly.
- Public schemas describe page classification and fetch attempts. Saved pages
  without classification still parse. Hydration preserves recorded classification
  and attempts without inferring missing fields or changing stored rows.
- The shared report view has optional `pageScope`, separate from audit counts,
  score calculations, and ranked fixes. It preserves both result populations,
  including advisory failures/errors beside passing or unassessed primary results.
- HTML and Markdown show expandable scope details with selected, input, and unread
  URLs. The terminal shows classification and extra advisory findings; its debugger
  shows each population's URL sets. Debug `fails` includes nested advisory failures.
  HTML marks informative results advisory even when registry tier is `scored`.
- MCP summaries expose structured scope. The browser JSON inspector uses text
  nodes for a bounded preview of uploaded scope data. Both report generators
  escape scanned text. No uploaded value becomes markup.
- CLI help, config docs, SDK/MCP website guides, scoring/migration notes, and
  architecture section 5.1 describe the new contract. Section 5.2 is unchanged.
  No audit verdict, evidence source, grade, or tier changed in P5, so no dossier
  change is required for this stage.

### Proof

The report regression suite initially had **6 failures and 1 pass**. It showed
that the old report paths lost scope/advisory details and persisted fetch attempts.
The focused suite then passed **278 tests across 14 files**. It covers the real
MCP request handler, equivalent scans through each declaration path, report
escaping, browser DOM rendering, saved-report compatibility, and nested findings.

An initial full run passed **5,936 tests; 219 skipped**. Its following typecheck
caught cross-package test imports outside the core package's `rootDir`. Those
integration tests now live under `scripts/`, where the existing root script
configuration checks cross-package source. Typecheck passes after that move.
A final legacy-reader test also pins the pre-existing fallback for absent
`pagesScanned`; no coverage is invented.

The built HTML report was opened in Chrome using a mixed-provenance fixture.
Both scope disclosures opened. Declared PASS, detected advisory FAIL, input URLs,
and the unread HTTP 503 appeared together without horizontal overflow. The
report keeps the project's existing styles. The built CLI help lists the new
controls; it retains the existing help exit code 1. Changesets' read-only status
resolves all four published packages to **7.0.0 major**. Package versions remain
unchanged until the release workflow runs.

Final validation:

- `pnpm build`: passed for every package.
- `pnpm test`: **5,937 passed; 219 skipped**, across **350 passed files and 1 skipped
  file**. Network verification remained enabled. This run includes the moved
  client integration tests and the legacy missing-pages case.
- `pnpm typecheck`: passed, including script tests and all 77 Astro files.
- `pnpm lint`: passed after replacing an empty transport mock and moving the MCP
  test's server import into `beforeAll`. Its 2 handler tests passed again after
  that test-only cleanup. No runtime code changed after the full passing run.
- `pnpm check:dossiers`: 215 audits and 215 dossiers agree.
- `pnpm check:requires`: 215 audit requirements agree with source reads.
- `pnpm check:audit-map`: 215 active audits and 207 legacy mappings agree.
- Targeted Prettier checks and `git diff --check`: passed.
- Staged binary-diff hash matches the value saved before P5. Section 5.2 and all
  following architecture text match their staged versions.

The built website JSON inspector also passed a Chrome check with the same fixture:
classification, advisory failure, unread URLs, score 100, and one audit remained
visible without horizontal overflow. The browser wrapper's upload command failed
with `filePaths: Invalid input: expected array, received undefined`; a local
`File`/`DataTransfer` change event exercised the actual file-input handler instead.
The temporary local preview server was stopped after verification.

### Limits and rollback

This is the P5 client/report stage. It does not finish P6's saved-corpus comparison
or publish a release. The website inspector bounds its preview and states those
limits; the JSON retains the full evidence. Detected types remain advisory even
with strong signals. Old reports retain their original page types and absent
coverage rather than undergoing a new classification pass.

Before release, revert the P5 client/schema/report slice to restore the previous
presentation and boundary behavior. Existing stored reports need no rewrite.
Prior staged work stays intact. No commit, staging, push, merge, or release occurs
as part of this stage.

## P6 execution record — 2026-10-07

Local release validation is complete. The [readiness record](./v7-release-readiness.md)
contains reproduction commands, scope limits, and release actions. Its JSON receipt
identifies the exact source fingerprint. Package versions remain workflow-owned;
no publication is claimed.

- Replayed all **41 saved responses** against the released 6.0.0 runner and the
  v7 candidate. **89 scenarios × 215 audits = 19,135 records per engine**.
- Reviewed **6,948 changed records**: **6,441** common-page gate changes, **468**
  article-population changes, and **39** informative-mode changes on gated detected
  populations. **3,577** change status; **3,371** retain NA. No assessed pass becomes
  an assessed fail. **12,187** records stay unchanged.
- Preserved each changed audit and its before/after state in the
  [comparison JSON](./v7-corpus-comparison.json). The strict review found zero
  unexplained changes and zero audit errors. A deliberately unknown transition
  failed review, confirming that the review does not accept every difference.
- Verified isolated ESM/CommonJS declarations and runtime exports for v7 scope
  controls and report data. Verified the built MCP stdio contract and CLI input
  rejection. Saved-report compatibility remains intact.
- Ran **3 full live scans**, with **0 skipped** and **0 invariant violations**.
  Two sites supplied readable text; the minimal site's missing body evidence
  produced an unscored result. Live invariants are consistency proof, not a
  ground-truth audit of all site findings.
- Ran all seven repository gates in order: each exited 0. The full suite passed
  **5,937 tests**, with **219 skipped**, across **350 passed files and 1 skipped**.
  Network verification stayed enabled. All 215 dossier/requirement records and
  207 legacy mappings agree.
- Confirmed Changesets selects **7.0.0 major** for all four published packages.
  No manifest was manually versioned. No product code changed in P6.

The replay uses real stored headers, bodies, and timings but has no recorded
secondary resources or accessibility-engine output. It is runner-level evidence,
not a full crawl. Mixed-provenance and concurrent-cache cases remain covered by
P4/P5 integration tests. The temporary replay's initial import error
`engine.extractMicrodata is not a function` was corrected by loading each engine's
parser module directly; the successful replay uses both structured-data extractors.

Prior staged changes remain intact. P6 adds validation scripts, consumer proof,
and release records only. Commit, push, merge, CI confirmation, workflow versioning,
and npm publication remain separate actions.
