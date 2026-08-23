# Plan 5b Wave B — graduate the 12 token-economics and answer-selection-forensics proposals

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the 12 feasible `token-economics` and `answer-selection-forensics` proposals out of `packages/core/src/audits/proposed/`. Ten become new audits — 5 in `content-extraction`, 5 in `answer-readiness` — and two fold into audits that already ship. The registry grows 184 → 194.

**Architecture:** Same graduation recipe as Wave A. Two departures, both decided by the user before the plan was written: (1) `gpt-tokenizer` and `@mozilla/readability` join `@forkpoint/agent-lighthouse-core`'s dependencies, so token counts are real BPE counts and the extraction audits can name the extractor the whole industry deploys; (2) `token-economics/signal-density-index-…` and `token-economics/data-uri-and-inline-svg-token-bloat` do **not** become new audits — their mechanisms are folded into the shipped `content-extraction/token-ratio` and `content-extraction/svg-bloat`, because shipping both would score one defect twice.

**Tech Stack:** TypeScript, vitest, cheerio, jsdom, `@mozilla/readability`, `gpt-tokenizer`, zod, tsup, changesets, oxlint.

## Global Constraints

- **Meta law:** `weight = weightForGrade(grade, tier)`. Grade B → `scored` at 0.6; grade C → `informative` at 0 with `scoreDisplayMode: 'informative'`. `sunset.test.ts` enforces `tier !== 'scored' ⟺ weight === 0`. Grade C in `scored` is unregistrable.
- **Grade is fixed by the dossier.** Never re-grade while implementing. What the implementation cannot reach goes under `## Deferred` in the dossier.
- **One audit = one file + one dossier.** `<category>/<slug>.ts`, `<slug>.test.ts` beside it, `docs/evidence/audits/<category>/<slug>.md`. Slugs keep the proposal's exact name so the `git mv` and the dossier gate agree.
- **`notApplicable` is never a vacuous pass.** Every test file calls `expectNotApplicableOnEmpty(audit)`.
- **Every new URL fetch is `isSafeUrl()`-gated.** Test suites `vi.mock` the fetcher — no real DNS in tests.
- **Token counts are BPE counts.** `countTokens()` from Task 1, `o200k_base`. No `chars / 4` anywhere in this wave.
- **Reuse Task 1's modules, do not duplicate them:** `gatherers/tokens.ts`, `gatherers/text-metrics.ts`, `gatherers/extraction.ts`. Also the existing `gatherers/sampled-pages.ts`, `gatherers/sitemap.ts`, `gatherers/pages.ts`, `parser.ts`.
- **Comments in English**, in every file.
- **Lint only via `rtk err pnpm lint`.** Never bare `pnpm lint`, never ESLint.
- **Four gates at every task boundary:** `AL_SKIP_NETWORK=1 pnpm test`, `pnpm typecheck`, `rtk err pnpm lint`, and `pnpm --filter @forkpoint/agent-lighthouse-core build && node scripts/check-dossiers.mjs`.
- **Do not push.** The controller pushes after user approval.

---

## File Structure

| File | Responsibility |
| :-- | :-- |
| `packages/core/package.json` | gains `gpt-tokenizer` and `@mozilla/readability` |
| `packages/core/src/gatherers/tokens.ts` | `countTokens`, `countTokensOf` — one BPE encoder for the whole scan |
| `packages/core/src/gatherers/text-metrics.ts` | `normalizeText`, `shingles`, `jaccard`, `sentences`, `wordCount` |
| `packages/core/src/gatherers/extraction.ts` | `readabilityArticle`, `semanticText`, `densityText` — three independent extractors |
| `packages/core/src/audits/content-extraction/<slug>.ts` + `.test.ts` | 5 new audits |
| `packages/core/src/audits/answer-readiness/<slug>.ts` + `.test.ts` | 5 new audits |
| `packages/core/src/audits/content-extraction/token-ratio.ts` | rewritten to the signal-density mechanism, id unchanged |
| `packages/core/src/audits/content-extraction/svg-bloat.ts` | extended to data: URIs, id unchanged |
| `packages/core/src/tests/new-in-v2.ts` | `NEW_IN_V2` gains 10 ids — folds add none, those audits are not new |
| `docs/evidence/audits/<category>/<slug>.md` | 10 moved dossiers; 2 absorbed into existing dossiers |
| `packages/core/src/audits/proposed/README.md` | stub count 40 → 28, 12 bullets deleted |
| `docs/evidence/proposals/README.md` | matching count decrement |
| `.changeset/v2-graduate-grade-b-wave-b.md` | one changeset for the wave |

---

## The per-audit recipe (Steps A–I)

Identical to Wave A. Each task below supplies only what differs: the class name, the meta values, and the "Test must pin" list that is its acceptance criteria.

**Step A** — read the stub sketch and the proposal dossier; the dossier governs on conflict.
**Step B** — write the failing test at `<category>/<slug>.test.ts`, one `it` per pinned row, plus `expectNotApplicableOnEmpty`.
**Step C** — implement `<category>/<slug>.ts`.
**Step D** — register: export, import, array entry in the category `index.ts`, all three in the same order.
**Step E** — `git mv` the dossier to `docs/evidence/audits/<category>/<slug>.md`, rewrite its frontmatter to the audit shape, append `## Implementation deviations` and `## Deferred`.
**Step F** — append the id to `NEW_IN_V2`.
**Step G** — `git rm` the stub, decrement both proposal READMEs.
**Step H** — all four gates.
**Step I** — commit, one commit per audit.

The scratchpad scripts `graduate.py` and `frontmatter.py` perform Steps D, F, G and most of E mechanically; they take `<domain> <slug> <ClassName> <prev-slug> <PrevClassName> <category>`.

---

### Task 1: shared token, text and extraction modules

**Files:**
- Modify: `packages/core/package.json`
- Create: `packages/core/src/gatherers/tokens.ts` + `.test.ts`
- Create: `packages/core/src/gatherers/text-metrics.ts` + `.test.ts`
- Create: `packages/core/src/gatherers/extraction.ts` + `.test.ts`

**Interfaces produced:**

```ts
// tokens.ts
export function countTokens(text: string): number;              // o200k_base
export function tokenBudget(parts: Record<string, string>): Record<string, number>;

// text-metrics.ts
export function normalizeText(text: string): string;            // lowercase, collapse ws, strip punctuation
export function shingles(text: string, n?: number): Set<string>; // default n = 5
export function jaccard(a: Set<string>, b: Set<string>): number;
export function sentences(text: string): string[];
export function wordCount(text: string): number;

// extraction.ts
export interface Extracted { text: string; html: string; title: string; source: string }
export function readabilityArticle(html: string, url: string): Extracted | null;
export function semanticText(html: string): Extracted;          // main / [role=main] / article, chrome removed
export function densityText(html: string): Extracted;           // text-to-link-density block scorer
```

**Test must pin:**
- `countTokens('hello world')` is a small positive integer, and `countTokens('')` is 0.
- `countTokens` of a 200-character base64 run exceeds `countTokens` of the 15-character URL that would replace it — the claim the data-URI audit makes.
- `shingles` of a text shorter than `n` words returns one shingle, not an empty set.
- `jaccard` of two empty sets is 1; of disjoint sets is 0.
- `sentences` splits on `.`/`?`/`!` followed by whitespace and does not split `e.g.` or a decimal.
- `readabilityArticle` returns `null` on a document with no prose, and returns the article text on a normal one.
- `semanticText` prefers `<main>` over `<article>` and strips `nav`, `aside`, `header`, `footer`.
- `densityText` picks the block with the most text per link, not the longest block.
- All three extractors carry a distinct `source` string, since three audits report which one disagreed.

**Commit:** `feat(core): BPE token counting, text metrics and three extractors for Wave B`

---

### Task 2: fold signal density into `content-extraction/token-ratio`

**Files:** rewrite `packages/core/src/audits/content-extraction/token-ratio.ts`; absorb `docs/evidence/proposals/token-economics/signal-density-index-content-tokens-delivered-tokens.md` into `docs/evidence/audits/content-extraction/token-ratio.md`; `git rm` the stub.

The audit id, slug, dossier path and migration-map entry do **not** change. `NEW_IN_V2` does **not** gain an id.

**Test must pin:**
- The ratio is BPE tokens, not characters: a document padded with 5,000 characters of base64 moves the ratio further than 5,000 characters of prose would.
- The numerator is `readabilityArticle`, falling back to `semanticText` when readability returns `null`, and `found` names which one was used.
- `details` carries the denominator split by bucket — `script`, `style`, `comment`, `attribute`, `text` — and the buckets sum to the delivered token count.
- The existing thresholds and statuses do not move: the audits that consumed this id keep their meaning.
- The absorbed dossier gains an `## Absorbed proposal` section naming the proposal, its grade and its evidence, so the merge is not a silent deletion.

---

### Task 3: fold data-URI bloat into `content-extraction/svg-bloat`

**Files:** extend `packages/core/src/audits/content-extraction/svg-bloat.ts`; absorb `docs/evidence/proposals/token-economics/data-uri-and-inline-svg-token-bloat.md` into `docs/evidence/audits/content-extraction/svg-bloat.md`; `git rm` the stub. Id unchanged; `NEW_IN_V2` unchanged.

**Test must pin:**
- A `data:image/png;base64,` run of 200+ characters is counted, and `found` reports its token cost.
- A data: URI inside a `style` attribute and one inside a `<style>` block are both counted.
- A short data: URI under the 200-character floor is ignored — a 1×1 tracking pixel is not a token problem.
- Inline SVG `d` and `points` attribute tokens are still counted, and `aria-hidden="true"` SVGs are still excluded, exactly as before the fold.
- `found` separates the two buckets, because the two fixes differ.

---

### Task 4: `content-extraction/preamble-tax-tokens-before-the-first-content-token`

Class `PreambleTaxTokensBeforeTheFirstContentTokenAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'medium'` · `effort: 'moderate'`.

**Test must pin:**
- A page whose first content token sits after a 60,000-token inline `<style>` fails, and `found` names the culprit node and its token cost.
- A page whose main content starts immediately passes.
- The offset is found by locating the extracted content's first ~200 normalized characters in the raw body; when that fails, the audit says so and returns `notApplicable` rather than guessing an offset.
- The largest single pre-content node is named — tag plus token count — not just the total.
- A page with no extractable main content is `notApplicable`.

---

### Task 5: `content-extraction/boilerplate-tax-across-the-crawl-unique-tokens-per-fetch`

Class `BoilerplateTaxAcrossTheCrawlUniqueTokensPerFetchAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'medium'` · `effort: 'complex'`.

**Test must pin:**
- Five pages sharing an identical 300-word header and footer report those shingles as boilerplate and fail.
- Five pages with distinct content pass.
- A shingle counts as boilerplate at document frequency ≥ 0.8, and the test asserts both sides of that boundary.
- Fewer than 3 sampled pages → `notApplicable`: document frequency over 2 pages is not a measurement.
- `found` states it in the dossier's own terms: an agent reading N pages pays X tokens to receive Y tokens of distinct information.
- The sample is stratified by URL path depth, so 20 blog posts cannot outvote 2 product pages.

---

### Task 6: `content-extraction/extraction-determinism-multi-extractor-agreement`

Class `ExtractionDeterminismMultiExtractorAgreementAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'high'` · `effort: 'moderate'`.

**Test must pin:**
- Three extractors agreeing above 0.8 pairwise Jaccard → `pass`.
- One extractor returning a different article → `fail`, and `found` carries the symmetric difference of the worst-disagreeing pair.
- `readabilityArticle` returning `null` → `fail` outright, with the reason stated: the most widely deployed extractor gives an agent nothing.
- Readability text under the 500-character threshold → `fail`, same reasoning.
- A page with no prose at all → `notApplicable`, not `fail`.

---

### Task 7: `content-extraction/markdown-alternate-discoverable-resolvable-faithful-cheaper`

Class `MarkdownAlternateDiscoverableResolvableFaithfulCheaperAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'medium'` · `effort: 'moderate'`.

**Test must pin:**
- No alternate discoverable by any of the three routes — `url + '.md'`, `Accept: text/markdown`, `Link`/`<link>` — → `notApplicable`, not `fail`. A site without a markdown alternate has not failed a check; it has not opted in.
- An alternate served as `text/markdown` → assessed; one served as `text/plain` or `text/html` → `fail` on resolvability, per RFC 7763.
- A `charset` or variant parameter on the content type is accepted.
- An alternate whose heading set matches the HTML and whose 5-gram recall is ≥ 0.9 → `pass`.
- An alternate missing half the headings → `fail`, and `found` lists the missing headings.
- The token saving is reported both ways: absolute and as a ratio.
- MDX/JSX component tags in the body do not break fidelity scoring but are reported separately as content the agent cannot interpret.
- At most 3 probe requests per scan, every URL `isSafeUrl()`-gated, asserted with a counting stub.

---

### Task 8: `content-extraction/json-ld-duplication-mass`

Class `JsonLdDuplicationMassAudit` · **grade C** → `tier: 'informative'`, `weight: weightForGrade('C', 'informative')` = 0, `scoreDisplayMode: 'informative'` · `defaultPriority: 'low'` · `effort: 'easy'`.

**Test must pin:**
- The registration test asserts `tier === 'informative'` and `weight === 0` — this is the wave's only non-scored audit.
- Two JSON-LD blocks declaring the same `(@type, @id)` with identical canonical JSON are reported as duplicates.
- An `articleBody` over 500 characters whose 5-gram shingles overlap the main content is reported as duplicated body text, with the overlap fraction.
- A page with one small `Organization` block reports a low mass and no finding.
- A page with no JSON-LD → `notApplicable`.
- The status is never `fail`: an informative audit reports, it does not accuse.

---

### Task 9: `answer-readiness/chunk-boundary-referent-integrity`

Class `ChunkBoundaryReferentIntegrityAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'high'` · `effort: 'moderate'`.

**Test must pin:**
- A chunk opening with "This means…" where no content word from the heading follows within 3 tokens → flagged `anaphoraOpen`.
- The same opening followed by a heading word → not flagged.
- A 40-word chunk containing no member of the entity set → flagged `entityAbsent`; the same chunk with the product name present → clean.
- "as described above", "see the table below" and "click here" → counted as `positionalRefs`; "above all" → not counted.
- The entity set is built from `h1`, `og:title` and JSON-LD `name`/`headline`, plus the acronym and first-token aliases.
- Score is passing chunks ÷ total chunks; below 0.8 → `fail`. Both sides of the boundary asserted.
- `found` quotes the offending sentence verbatim, under its heading, so the fix is a one-line edit.
- A page with no `h2`/`h3` → `notApplicable`.

---

### Task 10: `answer-readiness/extractor-survival-recall`

Class `ExtractorSurvivalRecallAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'high'` · `effort: 'moderate'`.

**Test must pin:**
- Key spans are `h1`, the first two sentences of each `h2`/`h3` section, every `caption`, `dt`, `th`, and every JSON-LD string that also occurs literally in the HTML.
- A spec table inside `<aside class="related-specs">` is dropped by the aggressive extractor → `fail`, and `found` names the ancestor chain that caused the drop.
- Recall ≥ 0.9 → `pass`; below → `fail`. Both sides asserted.
- `textRatio` under 0.25 is reported as over-strip risk; over 0.85 as boilerplate leakage. Neither alone decides the status.
- Both extractors are reported separately, because their disagreement is itself the signal.
- A page with no key spans → `notApplicable`.

---

### Task 11: `answer-readiness/section-split-risk-profile`

Class `SectionSplitRiskProfileAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'medium'` · `effort: 'moderate'`.

**Test must pin:**
- A section over 512 tokens → `SPLIT`, with severity `ceil(tokens / 512) - 1` — the number of headless tail chunks it produces.
- A body over 512 tokens with fewer than 2 `h2` elements → `BLOB`.
- A section under 25 tokens → `THIN`.
- A single `<table>` or `<ol>` whose markdown serialization exceeds 512 tokens → `ATOMIC-SPLIT`.
- `headingDistance` — the largest gap in characters between a heading and its section's end — is reported as the one actionable number.
- Score is the share of body tokens living in sections at or under 512 tokens.
- Token counts come from `countTokens`, never from `chars / 4`; a test asserts a known string's count matches the tokenizer.
- A page under 512 tokens total → `notApplicable`.

---

### Task 12: `answer-readiness/site-wide-passage-uniqueness-ratio`

Class `SiteWidePassageUniquenessRatioAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'medium'` · `effort: 'complex'`.

**Test must pin:**
- A sentence appearing on ≥ max(3, 5% of pages) is boilerplate; both sides of that boundary asserted.
- `uniqueFraction` under 0.30 flags the page.
- Two pages at 5-gram Jaccard ≥ 0.90 form a near-duplicate cluster.
- A cluster whose members all self-canonicalize → `fail`: exactly one survives the search engine's election and the rest are wasted.
- The same cluster with one member canonicalizing to another → not a failure.
- `medianUniqueFraction` is the site-level number; the three worst clusters are the actionable list.
- Fewer than 3 pages → `notApplicable`.

---

### Task 13: `answer-readiness/table-markdown-round-trip-loss`

Class `TableMarkdownRoundTripLossAudit` · `scoreDisplayMode: 'ternary'` · `tier: 'scored'` · grade **B** · `defaultPriority: 'medium'` · `effort: 'moderate'`.

**Test must pin:**
- A `th` with `colspan="2"` → round-trip loss, reported with the row and column coordinates and the cell text.
- A table with zero `th` and two numeric-majority columns → `headerlessNumeric` → `fail`.
- A currency symbol present only in the `<caption>` → `unitsStranded` → `fail`.
- A `<p>` or `<ul>` inside a `td` → `blockContentInCell`, reported.
- A ragged row — cell count differing from the header column count after span expansion — is reported.
- A clean two-column table round-trips with zero loss → `pass`.
- Score is tables with zero loss ÷ total main-content tables.
- A page with no table in main content → `notApplicable`.

---

### Task 14: close the wave

- [ ] **Step 1: Verify the counts moved together**

```bash
pnpm --filter @forkpoint/agent-lighthouse-core build
node scripts/check-dossiers.mjs
grep -c "^  '" packages/core/src/tests/new-in-v2.ts
head -3 packages/core/src/audits/proposed/README.md
find packages/core/src/audits/proposed -name '*.ts' | wc -l
```

Expected: `check-dossiers` reports **194 audits OK … no orphans**; `NEW_IN_V2` carries 46 ids (36 + 10 — the two folds add none); both proposal READMEs say **28**; the stub file count is 28.

- [ ] **Step 2: Run every gate**, then `npx changeset status`.
- [ ] **Step 3: Write `.changeset/v2-graduate-grade-b-wave-b.md`** — major on core, patch on the rest. State the two folds explicitly and the two new runtime dependencies, since both change what a consumer installs.
- [ ] **Step 4: Regenerate the website** — `npx tsx scripts/build-docs-data.ts`.
- [ ] **Step 5: Update `docs/superpowers/HANDOFF-v2.md`** — Wave B into the executed table, remaining scope down to Waves C and D (24 feasible stubs), gate line at the new counts.
- [ ] **Step 6: Commit.** Do not push; report to the user.

---

## Self-review

**Spec coverage.** All 13 stubs in the two domains have a disposition: 10 graduate, 2 fold, 1 (`answer-selection-forensics/question-heading-answer-span-alignment`, grade C, `llm-assisted`) stays a stub as one of the 3 infra-blocked, exactly as the handoff records.

**Placeholder scan.** Every task names its class, its four meta values and its acceptance list. No task says "similar to Task N".

**Type consistency.** `countTokens`, `shingles`, `jaccard`, `sentences`, `readabilityArticle`, `semanticText` and `densityText` are defined once in Task 1 and consumed unchanged in Tasks 2–13. `Extracted` is the single return shape of all three extractors.

**Ordering.** Task 1 blocks everything. Tasks 2 and 3 touch shipped audits and should land early, so the rest of the wave builds on the folded behaviour rather than around it. Task 14 is last because it pins the final counts.
