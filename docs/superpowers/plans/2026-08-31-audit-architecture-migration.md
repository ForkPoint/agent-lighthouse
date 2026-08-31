# Audit Architecture Migration — Roadmap

> **For agentic workers:** this file is a decomposition, not an executable plan.
> Each phase gets its own plan file under `docs/superpowers/plans/`, written
> immediately before that phase is executed and never before — later phases are
> measured against numbers that earlier phases change. Phase 1's plan is
> `2026-08-31-phase-1-truthful-fixtures.md`.

**Goal:** bring `main` into agreement with the model published at
`docs/architecture/audits.md`, in six phases, each of which ships a working
scanner and a gate that keeps its law from drifting back.

**Architecture:** every phase pairs one law with one enforcing test. A phase is
done when its gate is green and cannot be turned off by an exemption list. No
phase depends on a phase after it.

**Tech Stack:** TypeScript, vitest (root config only), Zod schemas, oxlint,
pnpm workspaces, Astro for the site.

## Global Constraints

Copied verbatim from `AGENTS.md` and `docs/architecture/audits.md`. Every task
in every phase inherits these.

- `weight = weightForGrade(grade, tier)` — A→1.0, B→0.6, C/D→0. Never hand-set
  a weight.
- An audit may only claim what a source documents.
- Absence is `notApplicable`, not `fail`. Only a present-and-defective artifact
  may fail.
- A precondition lives in the gatherer that performs the read. Never in
  `planAudits`. Never as an `EvidenceKey`.
- `details` values are `string | number | boolean | string[]`. Anything else
  throws in `AuditResultSchema.parse` and costs the whole result.
- Every audit is three files that must agree: the check, its test, its dossier.
  `pnpm check:dossiers` proves both directions.
- Comments, JSDoc and inline config comments are English.
- oxlint only. `// oxlint-disable-*` if a suppression is genuinely needed.
- Before every commit, all six in order:
  `pnpm build && pnpm test && pnpm typecheck && pnpm lint && pnpm check:dossiers && pnpm check:requires`
- A changeset for anything a user would notice. Changing what an audit reports
  is a `major`, even at weight 0.
- Never run `npx tsc -b`. Never run vitest from inside a package directory.

---

## The dependency order

```
   ┌─────────────────────────────────────────────────────────────┐
   │  PHASE 1   Truthful fixtures, and the absolute rule         │
   │            a scan that reached nothing verdicts nothing     │
   │            62 audits · 32.4 weight                          │
   └───────────────────────────┬─────────────────────────────────┘
                               │  the measuring instrument:
                               │  every later claim is counted
                               │  against these two fixtures
                               ▼
   ┌─────────────────────────────────────────────────────────────┐
   │  PHASE 2   The four-way read, past OpenAPI                  │
   │            merge PR 23, then split the sitemap the same way │
   │            2 audits fail on absence · 1.6 weight            │
   │            5 private copies of getSitemapResult             │
   └───────────────────────────┬─────────────────────────────────┘
                               │  product-identifiers has no `na`
                               │  branch — the page-type gate is
                               │  the only thing holding it back
                               ▼
   ┌─────────────────────────────────────────────────────────────┐
   │  PHASE 3   Page type becomes consent                        │
   │            --page-type scores; detection informs only       │
   └───────────────────────────┬─────────────────────────────────┘
                               │
                               ▼
   ┌─────────────────────────────────────────────────────────────┐
   │  PHASE 4   The origin gate, and audits stop fetching        │
   │            4a  isSafeUrl moves into ctx.fetch, keyed on     │
   │                origin — fixes 6, unblocks localhost         │
   │            4b  32 fetching audits move into gatherers       │
   └───────────────────────────┬─────────────────────────────────┘
                               │  3 and 4 both required: the origin
                               │  cache needs one fetching layer and
                               │  no page-type coupling
                               ▼
   ┌─────────────────────────────────────────────────────────────┐
   │  PHASE 5   One URL, one score, the origin cached            │
   │            MAX_PAGES_PER_SCAN 6 → 1 · 26 straddlers move    │
   └───────────────────────────┬─────────────────────────────────┘
                               │  `conditions` names origin.readAt
                               │  and cached, which exist only here
                               ▼
   ┌─────────────────────────────────────────────────────────────┐
   │  PHASE 6   The score states its conditions · the sweep      │
   └─────────────────────────────────────────────────────────────┘
```

---

## Baseline measurement

Taken 2026-08-31 on `docs/audit-architecture`, over all **215** registered
audits in `defaultConfig`, by constructing each audit and calling `audit(ctx)`
directly. Zero audits threw on either fixture.

**Fixture A — the origin never answered.** `homepageResult.error =
'ENOTFOUND'`, no pages, no root files, evidence from the real
`buildScanEvidence` (so `judgeable: false`).

| status       |  count | combined weight |
| :----------- | -----: | --------------: |
| `na`         |    153 |               — |
| `fail`       |     38 |            21.4 |
| `warn`       |     24 |            11.0 |
| `pass`       |      0 |               0 |
| **non-`na`** | **62** |        **32.4** |

Zero passes. The seven "vacuous passes" reported earlier in this work were an
artifact of the self-contradictory `emptyContext()` and do not exist.

**Fixture B — a bare but real site.** One reachable homepage, `lang="en"`, one
`<h1>`, about 100 words of prose, no optional convention adopted at all.

| status       |   count | combined weight |
| :----------- | ------: | --------------: |
| `na`         |     113 |               — |
| `fail`       |      47 |            22.6 |
| `warn`       |      30 |            19.6 |
| `pass`       |      25 |            18.2 |
| **non-`na`** | **102** |        **60.4** |

37 of those 47 fails and 25 of those 30 warns already fire on fixture A. They
are fixture A's bug, counted twice. **Fixture B's own contribution is 10 fails
(7.0 weight) and 5 warns (2.8 weight)** — the only rows a reviewer has to judge
on their merits:

```
fail  1.0  content-extraction/article-element
fail  1.0  content-extraction/header-footer
fail  1.0  content-extraction/main-element
fail  1.0  machine-discovery/in-content-links
fail  0.6  answer-readiness/extractor-survival-recall
fail  0.6  answer-readiness/review-signals
fail  0.6  answer-readiness/trust-signals
fail  0.6  content-extraction/content-depth
fail  0.6  machine-discovery/rss-feed
warn  1.0  access-crawl-control/canonical
warn  0.6  access-crawl-control/ai-usage-signal-coherence-across-channels
warn  0.6  access-crawl-control/no-blanket-block
warn  0.6  machine-discovery/discovery-index-coverage
```

(One B-only fail and one B-only warn carry weight 0 and are omitted; the counts
above include them.)

This is why fixture B is a **snapshot**, not an absolute rule. Some of these are
correct — a page with no `<main>` really is harder to extract from. Fixture A is
absolute because _no_ verdict about an unread site can be correct.

---

## Phase 1 — Truthful fixtures, and the absolute rule

**Law:** an audit that runs on a scan which obtained nothing reports on the
scanner, not on the site.

**Gate:** `packages/core/src/tests/unreachable-contract.test.ts` runs every
registered audit against fixture A and asserts `na`. **No exemption list.** A
law with an escape hatch is the thing this whole migration exists to stop.

**Second gate:** `packages/core/src/tests/bare-site.snapshot.test.ts` records
fixture B's verdict table. It fails on any change, so a later phase must state
what it moved and why. Not absolute — a reviewer may accept the new snapshot.

**Cost:** 62 audits, 32.4 weight. 15 of them share
`audits/access-crawl-control/_crawler-bot-audit.ts` and are one edit. 4 are
`openapi-*` and land with Phase 2's merge.

**Exit:** both gates green, `emptyContext()` no longer self-contradictory, one
`major` changeset.

**Plan:** `docs/superpowers/plans/2026-08-31-phase-1-truthful-fixtures.md`.

---

## Phase 2 — The four-way read, past OpenAPI

**Law:** absent / empty / malformed / readable, classified by the gatherer that
performs the read, judged over what survives.

**Prerequisite:** merge PR 23 (`fix/absent-artifact-is-not-a-failure`). It
already contains `gatherers/openapi.ts` and
`tests/absent-artifact-contract.test.ts`, which are the worked example and the
membership gate. Nothing in this phase should be re-derived.

**Work:** give `gatherers/sitemap.ts` the same four-way split, and move the five
private `getSitemapResult` copies onto it.

**Cost:** `machine-discovery/sitemap-lastmod` (grade A, weight 1.0, currently
`fail` at `priority: 'critical'` when there is no sitemap) and
`machine-discovery/sitemap-absolute-urls` (grade B, weight 0.6). 1.6 weight, 5
duplicate readers.

**Gate:** extend `absent-artifact-contract.test.ts` to the sitemap family. It
keys membership on the _import_ of the shared precondition, so an audit that
reads the artifact without importing it fails the test rather than being
forgotten.

**Exit:** the contract test covers both families, Phase 1's fixture A gate still
green, one `major` changeset.

---

## Phase 3 — Page type becomes consent

**Law:** the tool may guess; a guess may never move a score.

**Work:**

1. `ScanOptions.pageType?: PageType` and a `--page-type` CLI flag, parsed in
   `packages/cli/src/options.ts` next to `--preset`.
2. Rename `AuditMeta.applicablePageTypes` to `AuditMeta.pageTypes` — the meta
   stays static; the runner decides inclusion.
3. One expression in `planAudits`: an audit whose `pageTypes` do not include the
   **declared** type runs and is reported, with `scoreDisplayMode` forced to
   `'informative'`. `scorer.ts` is not touched.
4. Detection stays and is reported as a guess. It never gates anything.

**Why `scorer.ts` is untouched:** `isInformative` is already the documented
single source of truth for "shown, never scored", and `gatedMassShare` already
skips informative checks before counting — so an unconsented audit does not push
a site toward `overallScore: null`. Consent is not missing evidence.

**Why not drop the audits instead:** `hasAssessableCheck` returns `true` on an
empty check list, so a category emptied of its checks pays its full evidence
mass at score 0. Dropping punishes the site; informative protects it.

**Gate:** a source test asserting that no file under
`packages/core/src/audits/` references `pageType`. Page type becomes something
the runner knows and an audit cannot see.

**Prerequisite:** Phase 2. `agentic-commerce/product-identifiers` has no
`notApplicable` branch — the page-type gate is the only thing keeping
`fail: 'No Product schema found'` off a bakery. Remove the gate first and it
fails every site.

**Exit:** the source gate green, `--page-type product` scores what
`--page-type` omitted only reports, one `major` changeset.

---

## Phase 4 — The origin gate, and audits stop fetching

**Law:** the operator's URL is trusted; a URL taken from scanned content is not.
Consent attaches to the **origin**, not to the address class.

### 4a — the gate moves into `ctx.fetch`

Same-origin as the scan target passes unconditionally. Cross-origin must clear
`isSafeUrl`. Scanning `http://localhost:3000` before a deploy becomes a
first-class use rather than something the gate happens to permit.

Fixes the six audits that fetch a URL taken from scanned content with no
`isSafeUrl` import: `answer-readiness/author-page`,
`machine-discovery/rss-feed`, `machine-discovery/rss-feed-content`,
`machine-discovery/no-broken-links`, `agent-interfaces/openapi-servers`,
`agent-interfaces/search-endpoint`. `openapi-servers` is the sharpest: it
fetches `servers[0].url` straight out of a document the site wrote.

The other two of the eight without the import —
`answer-readiness/about-credentials` and `machine-discovery/cors-ai-files` —
fetch only `${ctx.baseUrl}${path}`. They are same-origin and correct as they
stand.

### 4b — the 32 fetching audits move into gatherers

One layer issues requests. It is then the only layer that needs the gate, the
only layer that can be counted against a budget, and the only layer that can
cache. A gatherer with exactly one consumer is still correct: the fetch becomes
visible to the scan instead of hidden in a private constant.

**Gate:** a source test asserting that no file under
`packages/core/src/audits/` references `ctx.fetch`. With no audit able to reach
the network, a private duplicate reader has nowhere to live — which is how the
OpenAPI family reached seven byte-identical copies of `getOpenApiSpec`.

**Exit:** both source gates green, a scan of `http://localhost:3000` completes,
32 private caps replaced by one budget, one `major` changeset.

---

## Phase 5 — One URL, one score, the origin cached

**Law:** an origin fact must be idempotent per origin.

**Work:**

1. `MAX_PAGES_PER_SCAN` 6 → 1. `discoverPages` and its URL-regex buckets are
   removed; the operator's URL is the scan.
2. Two scan units: **page**, keyed by URL; **origin**, keyed by origin and
   cached. Measured split: page-only 134 audits / 88.4 mass / 66.0%; origin-only
   50 / 31.8 / 23.7%; both 26 / 11.0 / 8.2%; neither 5 / 2.8 / 2.1%.
3. The 26 straddlers move to origin scope and read the **origin's homepage**,
   never the scanned page. They are not dual-subject — they are origin audits
   that also scrape a page for a discovery link. `openapi-exists` reads
   `/openapi.json` _and_ `<link rel="service-desc">`, so today scanning
   `/p/bread` and scanning `/` give the same origin two different verdicts.
4. One score, not two. Origin files genuinely affect every page — a `robots.txt`
   blocking GPTBot degrades every URL on the host — so folding that mass into
   the page's score is accurate.

**Open item, to be resolved in this phase's plan:** the 5 audits that read
neither pages nor root files (2.8 mass, 2.1%) have no scope yet.

**Gate:** an idempotence test — two scans of two different URLs on one origin
produce identical results for every origin-scope check.

**Exit:** the idempotence gate green, one `major` changeset.

---

## Phase 6 — The score states its conditions, and the warrant expires

**Work:**

1. `ScanReport.conditions`: `url`, `pageType` with its source (`declared` or
   `detected`), `origin.readAt` and `origin.cached`, `coverage` (page mass,
   origin mass, gated mass — all three already computed and never shown), and
   `unscored` (how many audits were informative, and why).
2. Every renderer in `packages/report` shows it beside the number.
3. `.github/workflows/audit-review-sweep.yml`: a scheduled job that sweeps
   `reviewed:` across `docs/evidence/audits/`, then opens **or updates** one
   rolling issue listing what is older than 6 months, oldest first, with grade
   and category.

**Why the sweep is deliberately the weakest gate here:** a stale grade is not a
broken build, and a score must not move because nobody did paperwork. It never
fails CI and never demotes an audit. Its only job is to make the debt impossible
to forget. Today 215 of 216 dossiers carry a `reviewed:` date, every one falls
between 2026-08-20 and 2026-08-24 — a single research sprint — and nothing reads
the field.

**Exit:** `conditions` in the JSON report and in every renderer, the workflow
green on a manual `workflow_dispatch`, one `major` changeset.

---

## Risks

| risk                                                                                          | mitigation                                                                                                                             |
| :-------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 1's absolute gate is loosened with an exemption list the first time an audit is awkward | The gate ships with no exemption mechanism to loosen. Adding one is a visible change to the test file, reviewable as such              |
| Phase 3 renames `applicablePageTypes` across 215 metas in one commit                          | The rename is mechanical and typechecked. It is its own commit, separate from the behaviour change, so a bisect can tell them apart    |
| Phase 4b touches 32 audits and could regress verdicts silently                                | Phase 1's fixture B snapshot is the detector. Any verdict that moves fails it and must be explained                                    |
| Phase 5 changes what a scan _is_, and every published score changes                           | `major` changeset, and the benchmark corpus is re-run and its numbers republished as part of the phase                                 |
| Later phases are planned against numbers earlier phases invalidate                            | Each phase's plan file is written immediately before that phase runs, never earlier. This roadmap deliberately stops at scope and gate |

## What this roadmap does not cover

- Whether an absent `robots.txt` on a _reachable_ site should `pass` rather than
  `warn`. RFC 9309 documents absence as "allowed", which makes a pass
  defensible, but that is a fixture B question and 20 audits share the file.
  Phase 1 is scoped to fixture A only, deliberately, to keep its gate absolute.
- The 25 audits that pass on fixture B. They were reviewed and read as
  legitimate — `https-enabled`, `single-h1`, `language-attribute`,
  `invisible-instruction-scan` are all true of a clean minimal page. No phase
  acts on them.
