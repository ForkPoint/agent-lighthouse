# Audit Architecture Migration — Roadmap

> **For agentic workers:** this file is a decomposition, not an executable plan.
> Each phase gets its own plan file under `docs/superpowers/plans/`, written
> immediately before that phase is executed and never before — later phases are
> measured against numbers that earlier phases change. Phase 1's plan is
> `2026-08-31-phase-1-truthful-fixtures.md`.

**Plan authority:** `docs/architecture/audits.md` owns the decisions. This
roadmap owns phase order, cross-phase interfaces and exit conditions. The one
current phase plan owns executable steps. If a step conflicts with the
architecture guide, the guide governs and the step must be corrected before
execution.

| plan level | current file | purpose |
| :--------- | :----------- | :------ |
| canonical design | `docs/architecture/audits.md` | settled rules and rejected designs |
| roadmap | this file | six phases and their dependency order |
| executable plan | `2026-08-31-phase-1-truthful-fixtures.md` | Phase 1 code, tests and commits |

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
- An artifact precondition lives in the gatherer that performs the read. Never
  in `planAudits`. Never as an `EvidenceKey`. The one exception is the
  domain-neutral unread-scan guard, which `planAudits` always enforces.
- A public production API must not default a safety gate to off. Unsafe
  full-registry planning belongs under test helpers only.
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
   │            the runner refuses an unread scan, so no audit   │
   │            has to remember to · 1 expression, 2 gates       │
   └───────────────────────────┬─────────────────────────────────┘
                               │  the measuring instrument:
                               │  every later claim is counted
                               │  against these two fixtures
                               ▼
   ┌─────────────────────────────────────────────────────────────┐
   │  PHASE 2   The four-way read, past OpenAPI                  │
   │            merge PR 23, then split the sitemap the same way │
   │            2 audits fail on absence · 1.6 weight            │
   │            4 copies of getSitemapResult + 1 inline read     │
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
   │            4b  36 network-reaching audits move to gatherers │
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

**None of those 62 verdicts reaches a user.** Measured through `planAudits`
rather than by calling `audit()` directly, fixture A gives
`runnable = 4, skipped = 211`: the evidence gate removes 211 audits through
their `requires` lines, and the remaining four — `https-enabled`,
`no-bot-detection`, `no-redirect-chains`, `no-blocking-captcha` — declare no
`requires` and each hand-roll `scanReadTheSite`. All four return `na`. The
scanner is correct today.

What is wrong is _how_ it is correct. The protection is one metadata line per
audit, plus 42 audits that hand-roll `scanReadTheSite` inside `audit()`, plus
four special cases. Nothing in an audit's own code enforces it. And the safety
net has a hole exactly where it is needed: 142 of 215 audits have no
`expectNotApplicableOnEmpty` call at all, and **all 62 sit in that gap** — the
73 audits the contract does cover return `na` on fixture A anyway.

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

**Law:** protection from verdicting on an unread scan belongs to the runner,
not to each audit's metadata.

**Work:**

1. `planAudits` gains one universal precondition, consulted _before_ `requires`:
   when `scanReadTheSite(ctx.evidence)` is false, every audit is skipped with
   `TAG_SKIPPED_NO_EVIDENCE` and `unreadSiteReason`. This is scan-level and
   domain-neutral — the one kind of precondition that belongs in the runner, and
   the kind `requires` already encodes. It is not an artifact precondition, which
   `docs/architecture/audits.md` §12 keeps out of `planAudits` for good reason.
   The guard is unconditional in the production planner. Remove
   `PlanOptions.enforceEvidence`; an omitted Boolean must not disable the law.
2. `emptyContext()` is replaced by two honest fixtures in
   `packages/core/src/tests/fixtures.ts`, both built through the real
   `buildScanEvidence`.
3. The 42 audits that hand-roll `scanReadTheSite` become dead code. Remove them
   in their own commit, after the gates are green.
4. A test-only `planAllAuditsForTest(defaultConfig)` helper bypasses both the
   evidence and page-type filters and returns all 215 registrations. It is not
   exported from `packages/core`. The full-registry test uses this helper rather
   than a production escape hatch.

**Gate (absolute):** `packages/core/src/tests/unreachable-contract.test.ts`
asserts `planAudits(fixtureA, defaultConfig).runnable.length === 0` over the
whole registry. **No exemption list.** It
covers all 215 audits by construction rather than by 73 opt-in calls, which is
the property `expectNotApplicableOnEmpty` never had.

**Gate (snapshot):** `packages/core/src/tests/bare-site.snapshot.test.ts`
records fixture B's verdict table. It fails on any change, so a later phase must
state what it moved and why. A reviewer may accept a new snapshot; fixture A's
gate has no such door.

**Cost:** one runner expression, two fixtures, two test files, 42 deletions.
Not 62 audit rewrites — the measurement above is why.

**Exit:** both gates green, `emptyContext()` gone, the 42 hand-rolled guards
gone, one `major` changeset (the `na` explanation text on an unreachable scan
changes for the four ungated audits).

**Plan:** `docs/superpowers/plans/2026-08-31-phase-1-truthful-fixtures.md`.

---

## Phase 2 — The four-way read, past OpenAPI

**Law:** absent / empty / malformed / readable, classified by the gatherer that
performs the read, judged over what survives.

**Prerequisite:** merge PR 23 (`fix/absent-artifact-is-not-a-failure`). It
already contains `gatherers/openapi.ts` and
`tests/absent-artifact-contract.test.ts`, which are the worked example and the
membership gate. Nothing in this phase should be re-derived.

**Work:** give `gatherers/sitemap.ts` the same four-way split, then move its
five private readers onto it. Four are byte-identical `getSitemapResult` copies,
each defined at `:13` — `machine-discovery/sitemap-exists`,
`sitemap-absolute-urls`, `sitemap-lastmod`, `discovery-index-coverage`. The
fifth, `access-crawl-control/sensitive-paths`, has no helper to swap: it reads
`ctx.rootFiles['/sitemap.xml'] ?? ctx.rootFiles['/sitemap-index.xml']` inline at
`:172` and parses it on the spot, so that read is rewritten rather than
redirected. Five readers, four copies.

**Cost:** `machine-discovery/sitemap-lastmod` (grade A, weight 1.0, currently
`fail` at `priority: 'critical'` when there is no sitemap) and
`machine-discovery/sitemap-absolute-urls` (grade B, weight 0.6). 1.6 weight, 5
duplicate readers — 4 copies of the helper plus 1 inline read.

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
3. Add `PageContext.pageTypeSource: 'declared' | 'detected'`. `pageType` stays
   on every page — it is not removed and not made optional. Only its provenance
   becomes explicit. The scan target gets `declared` from `--page-type`; each
   URL named in `ScanOptions.pages` gets `declared` from its `PageOverride`;
   every other page keeps its detected type and is marked `detected`.
4. One pure runner **scope function** replaces the separate `scoreModeFor`
   decision. Given an audit's meta and the scan context it returns both halves
   of the same decision at once: the immutable page set that audit may read,
   and its `scoreDisplayMode`. Three cases, and no fourth:

   | audit                                                             | pages it gets               | mode        |
   | :---------------------------------------------------------------- | :-------------------------- | :---------- |
   | universal (no `pageTypes`)                                        | every page                  | meta mode   |
   | typed, and at least one **declared** page matches its `pageTypes` | all matching declared pages | meta mode   |
   | typed, no declared match                                          | matching **detected** pages | informative |

   A page selected because of a detected page type never enters a scored page
   set. Putting the page set and the mode in one function makes it impossible
   to score one while reading the other. `AuditPlan.runnable` remains
   `{ reg, categoryId }`; shared audit meta is never mutated.

5. Detection stays and is reported as a guess. It may select evidence for an
   informative result. It never authorizes scoring.
6. Split category mass into `registryMass` and `assessedMass`.
   `registryMass` is the sum of registered audit weights and measures coverage.
   `assessedMass` is the sum of weights whose results are neither `na` nor
   informative and weights the category in `calculateOverallScore`.
7. **Remove the 17 direct `page.pageType` reads in audit sources** — see the
   next section, which names every one and its replacement.

**Why `scorer.ts` changes:** `isInformative` already removes an unconsented
result from its category mean, but `calculateOverallScore` still applies the
category's full static registry mass whenever one assessable check remains.
That inflates the remaining audits. Structured Data can apply 9.6 category mass
to 2.0 assessed mass, a 4.8-times increase. The overall score must use
`assessedMass`. `gatedMassShare` stays separate because consent is not missing
evidence.

**Why not drop the audits instead:** `hasAssessableCheck` returns `true` on an
empty check list, so a category emptied of its checks pays its full evidence
mass at score 0. Dropping punishes the site; informative protects it.

### The 17 audits that read `pageType`, and what replaces each

Gate 1 rejects a `PropertyAccessExpression` named `pageType` in any production
file under the audit tree. **17 files read `page.pageType` today**, so the gate
cannot go green until all 17 are rewritten. They are named here the way Phase 1
names its 42 guards and Phase 4a names its six unguarded fetchers — this is
scoped work, not a mechanical sweep, because the reads are per-page _selection_
and the runner scope function is what takes selection over.

**Group 1 — selection an audit no longer performs (11 files).** Each filters
`ctx.pages` down to the types its meta already declares, which is exactly what
the scope function now hands it. The read is deleted and the audit iterates the
page set it was given.

| file                                               | read at | its filter              |
| :------------------------------------------------- | ------: | :---------------------- |
| `answer-readiness/trust-signals.ts`                |  `:134` | `homepage`              |
| `answer-readiness/publication-date.ts`             |   `:13` | `content`               |
| `answer-readiness/dates-on-content.ts`             |   `:28` | `content`               |
| `answer-readiness/review-signals.ts`               |  `:238` | `homepage` or `product` |
| `content-extraction/aside-element.ts`              |  `:106` | `content`               |
| `agentic-commerce/offer-schema.ts`                 |   `:56` | `product`               |
| `agentic-commerce/landed-cost-and-returns.ts`      |  `:190` | `product`               |
| `agentic-commerce/offer-truth-consistency.ts`      |  `:149` | `product`               |
| `agentic-commerce/buyable-variant-resolution.ts`   |  `:179` | `product`               |
| `agentic-commerce/checkout-offer-field-mapping.ts` |  `:220` | `product`               |
| `agentic-commerce/agent-ua-commerce-parity.ts`     |  `:115` | `product`               |

`agent-ua-commerce-parity` is the one file in this group whose meta does not yet
declare the type it filters on: it has no `applicablePageTypes` at all. **Add
`pageTypes: ['product']` to its meta** as part of this phase, or the scope
function hands it every page and the filter's removal changes its verdict.

`structured-data/review-schema.ts:211` is a separate subgroup case. Its meta
allows `homepage` and `product`, but one warning concerns product pages only.
Replace its direct read with `pagesOfType(ctx, 'product')`. A gatherer may select
one declared type from a multi-type runner-approved set. No audit reaches
`p.pageType` to do it.

**Group 2 — objective artifact unions (2 files).**
`structured-data/article-schema.ts:24-27` and
`structured-data/speakable-schema.ts:91-96` accept either a content page or a
page carrying Article, BlogPosting or NewsArticle markup. Deleting the union
would restore the Shopify-route false negative documented in both files.

Move that union into `gatherers/pages.ts`. Each per-audit context view keeps
`allPages` as a read-only, gatherer-only view of the full sample. The gatherer
returns the runner-approved content pages plus any page whose markup explicitly
declares an Article type, deduplicated by URL. The markup is observed evidence,
not a detected page-type guess. Extend the AST boundary check so production
audit files cannot read `allPages` directly.

**Group 3 — an objective homepage predicate (3 files).** These three use
`pageType` as a stand-in for the first sampled page at the origin root. Preserve
that predicate in `gatherers/pages.ts`: the page must be first in the scan and
its URL pathname must be `/`. A deep target such as `/docs` is not a homepage.

| file                                               | read at | today                                         | replacement                                 |
| :------------------------------------------------- | ------: | :-------------------------------------------- | :------------------------------------------ |
| `access-crawl-control/robots-directives.ts`        |  `:200` | `isHomepage: page.pageType === 'homepage'`    | call the shared homepage predicate          |
| `content-extraction/markdown-alternate.ts`         |  `:236` | `find((c) => c.pageType !== 'homepage')`      | use the first non-homepage page             |
| `answer-readiness/content-without-clickthrough.ts` |   `:94` | `if (p.pageType === 'homepage') return false` | skip only the objective homepage            |

**One implementation constraint, recorded because it is easy to miss.** Handing
each audit an immutable per-audit view of `CheckContext` collides with the
gatherer caches: `gatherers/conditional.ts:41`, `feeds.ts:322`,
`sampled-pages.ts:9`, `media.ts:305`, `sitemap.ts:205` and `ua-parity.ts:238`
each key a `WeakMap` on the `CheckContext` **object identity**. Six per-audit
views means six cache misses per audit and six times the fetches. The views must
therefore carry a stable shared `cacheOwner` — one object per scan, threaded
through every view — and those six gatherers key on that instead of on the
context they were passed.

**Gates:**

1. A source check asserts that no production file under
   `packages/core/src/audits/` **reads** `pageType` or the gatherer-only
   `allPages`. Page scope belongs to the runner and gatherers. The check parses
   the TypeScript and inspects the syntax tree — see
   [The two source gates parse, they do not grep](#the-two-source-gates-parse-they-do-not-grep)
   — so a comment, a JSDoc line or a dossier quotation that names `pageType` is
   not a violation, and a property read that is renamed but still executed still
   is.
2. Scorer tests prove that an audit with weight 1.0 contributes 1.0 when scored
   and zero when informative or `na`; a partly informative category uses its
   assessed mass, not its registry mass.
3. Runner tests prove declared → scored, detected → informative, and static
   informative → informative.

**Prerequisite:** Phase 2. `agentic-commerce/product-identifiers` has no
`notApplicable` branch — the page-type gate is the only thing keeping
`fail: 'No Product schema found'` off a bakery. Remove the gate first and it
fails every site.

**Exit:** all three gates green — which requires all 17 `pageType` reads gone and
`agent-ua-commerce-parity` carrying `pageTypes: ['product']` — `--page-type
product` scores what `--page-type` omitted only reports, coverage exposes
registry and assessed mass, one `major` changeset.

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

### 4b — the 36 network-reaching audits move into gatherers

One layer issues requests. It is then the only layer that needs the gate, the
only layer that can be counted against a budget, and the only layer that can
cache. A gatherer with exactly one consumer is still correct: the fetch becomes
visible to the scan instead of hidden in a private constant.

**What 36 counts.** A _network-reaching audit_ is a registered audit that can
issue a request, directly or through a helper — the denominator recorded in
[`docs/architecture/audits.md`](../../architecture/audits.md). 31 call
`ctx.fetch` in their own file. The other 5 —
`mcp-version-downgrade`, `mcp-tool-description-coverage`,
`mcp-tool-contract-validity`, `mcp-tools-list-determinism`,
`mcp-modern-era-reachability` — name no fetch and go through
`agent-interfaces/_mcp-client.ts`, a shared helper inside the audit tree that is
registered as no audit. This phase moves that helper into a gatherer alongside
the 31, which is what empties the tree.

**Gate:** `pnpm check:audit-boundaries` parses every production TypeScript file
under `packages/core/src/audits/` — audit sources and the private helpers beside
them, `*.test.ts` excluded — and rejects an **executable** fetch reference:
`ctx.fetch` and any aliased binding of it, a destructured `fetch`, the global
`fetch`, an import from `../../fetcher`, and an import from a direct HTTP client
(`undici`, `node:http`, `node:https`, `axios`, `got`, `node-fetch`). Tests may
mock gatherers. No second fetch-free audit context type is added; the source
gate remains necessary either way.

Keep the pre-request DNS check and repeat it on every redirect. Do not pin the
checked IP inside the application HTTP client. Document two deployment modes:
the local CLI may reach the operator-selected local origin; hosted and
multi-tenant deployments block localhost, private ranges and metadata endpoints
with an outbound network rule.

**Exit:** the source gate green, a local CLI scan of
`http://localhost:3000` completes, hosted egress tests prove private destinations
are blocked, the mixed private limits are replaced by one shared budget, one
`major` changeset.

### The two source gates parse, they do not grep

Phase 3's `pageType` gate and Phase 4b's `check:audit-boundaries` are the only
two checks in this roadmap that read source rather than run it. Both parse the
TypeScript with the compiler's own parser — `ts.createSourceFile`, no type
checker, no program, no import traversal — and walk the syntax tree. Neither
matches text.

**Why, concretely.** A substring scan already produced a wrong number on this
work, three ways at once. `operability-safety/unsafe-agent-triggerable-affordances`
was counted as a fetching audit because line 6 of it reads "Its test pins that
`ctx.fetch` is never called" — the audit never fetches; the comment does.
`agent-interfaces/_mcp-client.ts` was counted as an audit, and it is a helper
registered nowhere. And five audits that fetch only through that helper were
missed, because none of them contains the string. The corrected count and
rejected text scan are recorded in
[`docs/architecture/audits.md`](../../architecture/audits.md). A grep fails the
first file forever, and it also passes any behaviour-preserving rename —
`const f = ctx.fetch` reads no differently to a regular expression than a
sentence about fetching does.

**What each gate walks.**

| gate     | rejected node                                                                                                                                                                                                                                                                               | accepted                                                                                     |
| :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------- |
| Phase 3  | a `PropertyAccessExpression` whose name is `pageType`; an `ElementAccessExpression` whose argument is the string literal `'pageType'`; a `BindingElement` destructuring `pageType`                                                                                                          | the identifier inside a comment, a JSDoc tag, an ordinary string literal, or a template span |
| Phase 4b | `PropertyAccessExpression` `.fetch` on `ctx` or any local alias of it; a `BindingElement` destructuring `fetch`; a bare `fetch` identifier in call position that no local binding shadows; an `ImportDeclaration` whose module specifier resolves to the fetcher or to a direct HTTP client | the same four literal contexts, and any of these inside a `*.test.ts` file                   |

Comments and JSDoc are never visited, because the parser attaches them as
trivia rather than as nodes. String and template literals are visited and
skipped by kind. That is the whole difference from grep, and it is the whole
point.

**One carve-out, and it is not an exception to that rule.** In
`page['pageType']` the string literal is not prose — it is the property name of
an `ElementAccessExpression`, and skipping it would skip exactly the read the
gate exists to catch. So the argument of an `ElementAccessExpression` is
inspected as a name, while every other string literal is skipped. There is no
type-position rule and no resolution step: both are impossible without a type
checker, and the gate has none by design. A `pageType` that appears only in a
type annotation is not a value read and is not rejected.

**Scope.** Both gates read every production `.ts` file under
`packages/core/src/audits/`, not only the files that export an audit. The
private helper beside an audit is inside the boundary the gate defends, so it is
inside the set the gate reads. `agent-interfaces/_mcp-client.ts` is the live
example: it is registered as no audit, it imports the fetcher, and five audits
reach the network through it and name no fetch themselves. The gate sees the
helper, so it sees the leak.

**No import graph, and the reason is the scope above.** Neither gate follows a
local import to ask whether the imported module fetches, and neither needs to.
The soundness argument is not that every audit names its own fetch — five of
them already do not. It is that **every production module inside the audit tree
is itself scanned**, so a module that reaches the network is caught in its own
file whether or not its callers name it. `_mcp-client.ts` is caught on its
`../../fetcher` import, not on anything its five callers contain.

That argument holds exactly as long as the tree stays the boundary, so the
boundary is a rule and not an observation: **an audit's network helper stays
inside `packages/core/src/audits/` until Phase 4b moves it into a gatherer.** It
may not move into some third directory the gate does not read while its callers
stay behind. Under that rule an import graph buys nothing, so it is not built.
Revisit only if that rule is broken.

## Phase 5 — One URL, one score, the origin cached

**Law:** an origin fact must be idempotent per origin.

**Work:**

1. `MAX_PAGES_PER_SCAN` 6 → 1. `discoverPages` and its URL-regex buckets are
   removed; the operator's URL is the scan.
2. Two scan units: **page**, keyed by URL; **origin**, keyed by origin and
   cached for canonical anonymous reads. The shared key is
   `origin + ORIGIN_EVIDENCE_VERSION`; records store `readAt` and expire by a
   documented TTL. URL credentials, authorization headers and explicit
   prefetched evidence bypass the shared cache. Raw credentials never enter a
   key. Measured split: page-only 134 audits / 88.4 mass / 66.0%; origin-only
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

**Gates:**

1. An idempotence test — two anonymous scans of two different URLs on one
   origin produce identical results for every origin-scope check.
2. A cache-isolation test — an authenticated origin read is never reused by an
   anonymous scan, and neither URL credentials nor authorization values appear
   in a cache key or stored report.
3. A version test — changing `ORIGIN_EVIDENCE_VERSION` forces a fresh origin
   read.

**Exit:** the idempotence gate green, one `major` changeset.

---

## Phase 6 — The score states its conditions, and the warrant expires

**Work:**

1. `ScanReport.conditions`: `url`, `pageType` with its source (`declared` or
   `detected`), `origin.readAt` and `origin.cached`, `coverage` (registry mass,
   assessed mass, page mass, origin mass and gated mass), and
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
| A partly informative category keeps its full registry mass                                    | Phase 3 stores registry and assessed mass separately; scorer tests pin the 1.0 audit weight through the overall formula                |
| Phase 4b touches 36 audits and could regress verdicts silently                                | Phase 1's fixture B snapshot is the detector. Any verdict that moves fails it and must be explained                                    |
| A shared origin cache crosses authentication boundaries                                       | Only canonical anonymous reads use it; authenticated and explicitly prefetched reads bypass it, and isolation tests pin the rule       |
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
