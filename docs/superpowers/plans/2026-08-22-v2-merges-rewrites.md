# v2 Merges, Splits & Rewrites Implementation Plan (Plan 4 of 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the 34 merging entries into their 23 target audits, execute the 2 splits and the security-header consolidation, split `_a11y.ts` into per-rule files, and rewrite every `TODO(redeem)` audit per its dossier's required rework — ending with a registry where every audit is one file, one honest signal, one dossier.

**Architecture:** Marker-driven. Requirements live in three places the code already carries: (1) `TODO(merge|consolidate|split|rewrite)` headers on source files, (2) each dossier's "Required rework" / "Graded evidence" sections, (3) `packages/core/src/audits/REWORK-TODO.md`. `packages/core/migration-map.json` is the completion checklist: when a fold lands, its entries flip `merging → renamed` (drop `interim`); the plan is done when zero `merging` entries remain except deliberate deferrals. Registry shrinks 181 → 148 (see per-task math; final count asserted in Task 14).

**Tech Stack:** TypeScript, zod, vitest, changesets. Branch: continue on `feat/v2-engine`.

**Data sources:** `docs/evidence/v2-audit-map.md` (map, user-approved 2026-08-21) · `packages/core/migration-map.json` (34 merging entries) · `packages/core/src/audits/REWORK-TODO.md` (9 approved + 15 pending-triage redeems — executing this plan approves the 15) · dossiers under `docs/evidence/audits/` and `docs/evidence/deletions/`.

## Global Constraints

- Tests from REPO ROOT: `pnpm test <path>`; full `pnpm test` must end 0 failures. Never `pnpm --filter ... test -- run`.
- `pnpm typecheck` (build core first if packages/report complains). NEVER `npx tsc -b`. Lint: `rtk err pnpm lint`. Code comments English. Never push (controller pushes).
- One audit = one file, one dossier (project memory). Every new/merged audit gets its own dossier under `docs/evidence/audits/<cat>/<slug>.md` with frontmatter `audit: <cat>/<slug>`, `category`, `slug`, `evidence_grade`; `node scripts/check-dossiers.mjs` must stay green after EVERY task.
- Weight law unchanged: `weight: weightForGrade(evidenceGrade, tier)`, never hand-written. Tier from strongest surviving evidence of the merged signal (grade of the merged dossier). Weight-0 ⇒ `scoreDisplayMode: 'informative'` (sunset.test.ts invariant).
- Merged-away dossiers: `git mv` to `docs/evidence/merged/<v2-cat>/<old-slug>.md`, append one line `**Merged into:** <target id> (Plan 4, 2026-08-22)`. Create `docs/evidence/merged/README.md` in Task 2 (first fold) listing every absorbed slug → target.
- Migration-map maintenance per fold: absorbed v1 ids flip `"status": "merging"` → `"renamed"`, `to` stays the target id, `interim` REMOVED, `link` → the target's dossier path. `migration-map.test.ts` totals stay 207; the merging-count assertions added in Task 14 pin the shrinking count.
- Absorbed audit files + colocated tests deleted in the same commit as the fold; the target's test file must cover the absorbed signal's core cases (port the discriminating cases, drop duplicates).
- No new categories, no id changes for surviving audits (except the 2 splits and the collision folds whose targets are named below). SECTION_GROUPS untouched.
- `docs/evidence/v2-audit-map.md` is historical record — do NOT edit it.

## File Structure (end state)

- `packages/core/src/audits/operability-safety/` — `_a11y.ts` GONE; 17 per-rule files (one per contained audit, slugs unchanged) + shared engine under `packages/core/src/audits/operability-safety/engine/` (unchanged location).
- Absorbed files deleted: 5 per-bot files, 4 security-header files, ~20 merge-away files.
- New files: `access-crawl-control/ai-bot-directives.ts`, `operability-safety/security-header-hygiene.ts`, `structured-data/service-schema.ts` (renamed from service-product-schema).
- `docs/evidence/merged/` — new tree for absorbed dossiers.

---

### Task 1: Split `_a11y.ts` into per-rule files

**Files:** Delete `packages/core/src/audits/operability-safety/_a11y.ts` (+ its colocated test); Create 17 files `packages/core/src/audits/operability-safety/<slug>.ts` (slugs = the 17 registered ids' slug parts: landmark-unique, label, accessible-names, dialog-name, aria-hidden-body, aria-roles, aria-attributes, aria-relationships, duplicate-id, autocomplete, nested-interactive, table-headers, document-title, frame-title, meta-refresh, tabindex, presentation-conflict) each with its own colocated test; Modify `operability-safety/index.ts`, engine files as needed.

**Interfaces:** Produces: 17 audit classes named `<PascalSlug>Audit` (e.g. `LandmarkUniqueAudit`, `LabelAudit`) each in its own file, meta unchanged except nothing else. Engine (`engine/rules.ts`, `engine/checks.ts`, `engine/standards.ts`, runner) stays shared — per-rule files import the runner and their rule ids exactly as the classes inside `_a11y.ts` do today.

- [ ] **Step 1:** Read `_a11y.ts`; extract each audit class verbatim into its own file (same meta, same rule wiring); shared helpers stay in `engine/` or a new `_shared.ts` if any helper is class-local. Split the colocated test by audit; port every test case.
- [ ] **Step 2:** Remove the dead `is-on-screen` check from `engine/checks.ts` (only marquee/blink consumed it — sunset in Plan 3; verify zero rule references before deleting, else leave and note).
- [ ] **Step 3:** Fix the 17 dossiers' frontmatter `audit:` field: `operability-safety/_a11y` → `operability-safety/<slug>` (files at `docs/evidence/audits/operability-safety/<slug>.md`).
- [ ] **Step 4:** Update `operability-safety/index.ts` imports (order unchanged — also fix the Plan-3 deferred ordering drift: array order must equal export order equal map order). Registry count stays 181.
- [ ] **Step 5:** Full `pnpm test` + `node scripts/check-dossiers.mjs` + typecheck + lint green. Commit `refactor(core)!: split _a11y.ts into per-rule audit files`.

---

### Task 2: Consolidation — `access-crawl-control/ai-bot-directives`

Sources (5, all `TODO(merge)`): bytespider, cohere-ai, youbot, diffbot, ai2bot (v1 2.9–2.13).

- [ ] Create `access-crawl-control/ai-bot-directives.ts` per REWORK-TODO: parse robots.txt ONCE (use the Plan-1 robots gatherer/`_robots-txt-helpers.ts`), emit an informational per-bot table in details, score ONLY on documented-active bots. Read the 5 dossiers first; merged dossier `docs/evidence/audits/access-crawl-control/ai-bot-directives.md` cites the strongest evidence per bot; grade = strongest proven consumer path among the five (write the grade the evidence supports — expect B; tier `scored` per REWORK-TODO target).
- [ ] While here, drop the dead `CrawlerBot.id` numeric field from `_robots-txt-helpers.ts` and every per-bot audit object (final-review F6 — nothing reads it).
- [ ] TDD: failing test first (allow/deny table cases, scoring only on active bots), then implement. Delete the 5 source files + tests; move 5 dossiers to `docs/evidence/merged/access-crawl-control/`; create `docs/evidence/merged/README.md`. Register the new audit in `index.ts` (position of the first absorbed row). Registry 181 → 177.
- [ ] Migration map: 2.9–2.13 → `renamed`, `to: access-crawl-control/ai-bot-directives`, drop `interim`, link → new dossier.
- [ ] Full gates green. Commit `feat(core)!: consolidate per-bot audits into ai-bot-directives`.

---

### Task 3: Consolidation — `operability-safety/security-header-hygiene`

Sources (4, all `TODO(consolidate)`): hsts-header, csp-header, content-type-options, security-txt (v1 8.2/8.3/8.4/8.7).

- [ ] Create `operability-safety/security-header-hygiene.ts`: one informative audit (map: "weight 0, never fails a site") reporting presence/sanity of the 4 signals in details; `tier: 'informative'`, grade = strongest of the four (B from hsts), weight 0, `scoreDisplayMode: 'informative'`. Merged dossier with per-header evidence. TDD.
- [ ] Delete 4 files + tests; dossiers → `docs/evidence/merged/operability-safety/`; register; registry 177 → 174. Migration map: 4 entries → `renamed` to the new id, drop `interim`.
- [ ] Full gates. Commit `feat(core)!: consolidate security headers into security-header-hygiene (informative)`.

---

### Task 4: Merge folds — machine-discovery (6 targets)

Per fold, same recipe (applies to Tasks 4–8): read target + absorbed file and both dossiers; port the absorbed signal into the target (the map row note says which half survives); port discriminating test cases; delete absorbed file+test; absorbed dossier → `docs/evidence/merged/<cat>/`; extend target dossier with the absorbed evidence (grade = strongest of the pair — raise the target's grade/tier/weight only if the absorbed evidence is stronger AND proven for the merged signal); flip migration-map entries; keep target's id/slug. Remove the target's `TODO(merge)`-related header notes when the fold lands.

| Target | Absorbs (interim slug) | Map note |
| :-- | :-- | :-- |
| llms-txt-structure (NEW audit — targets don't exist yet) | llms-txt-blockquote + llms-txt-sections | one llms.txt structure audit: blockquote + section shape |
| discovery-index-coverage | no-orphan-pages | orphan detection = index-coverage half |
| llms-txt-exists | llms-txt-link | C3 collapse: file + discovery link one audit |
| rss-feed | rss-feed-link | C3 collapse |
| ai-file-delivery | cache-headers | delivery headers half |
| in-content-links (also `TODO(rewrite)`) | internal-cross-linking | rewritten: in-content links only — execute the rewrite per its header while folding |

- [ ] llms-txt-structure: create `machine-discovery/llms-txt-structure.ts` from the two absorbed audits (2 → 1), new merged dossier, register where llms-txt-blockquote sat. Registry −1 per 2-way fold with new file; −1 per plain fold. Running total 174 → 168.
- [ ] Full gates after the task (all 6 folds one commit is too big — commit per fold or per pair, task-reviewer sees the whole task diff). Commit(s) `feat(core)!: fold <absorbed> into <target>`.

---

### Task 5: Merge folds — access-crawl-control (2 targets)

| Target | Absorbs | Note |
| :-- | :-- | :-- |
| robots-directives | no-noindex + meta-robots | three-way robots-meta-directives audit (2.25 survivor) |
| canonical (also `TODO(rewrite)`) | canonical-url | resolved hrefs + homepage-collapse detection per rewrite header |

- [ ] Same recipe. Registry 168 → 165. Commits per fold. Full gates.

---

### Task 6: Merge folds — answer-readiness (4 targets)

| Target | Absorbs | Note |
| :-- | :-- | :-- |
| core-open-graph | og-site-name + twitter-card | social-meta diagnostic; twitter-card's redeem: fix twitter:*/og:* fallback errors; og evidence A, twitter informative-only — merged audit stays scored on og signals, twitter part informational detail |
| dates-on-content | last-updated-indicator | |
| meta-description | meta-description-aeo | quality criteria without the invented "AEO formula" (redeem note) |
| review-signals | blockquote-usage | |

- [ ] Same recipe. Registry 165 → 160. Full gates.

---

### Task 7: Merge folds — agent-interfaces (4 targets)

| Target | Absorbs | Note |
| :-- | :-- | :-- |
| search-endpoint | website-search-action | one site-search audit (API + Schema.org action halves) |
| openapi-exists | openapi-link | redeem note: one discovery audit incl. RFC 9727 api-catalog (graded B), drop link-tag hard requirement |
| ai-catalog-exists | ai-catalog-link | fold link check in; the ARD rewrite itself is Task 10 |
| mcp-endpoint | mcp-capabilities + webmcp-tool-annotations | one MCP endpoint audit |

- [ ] Same recipe. Registry 160 → 155. Full gates.

---

### Task 8: Merge folds — remaining (4 targets)

| Target | Absorbs | Cat | Note |
| :-- | :-- | :-- | :-- |
| review-schema | product-reviews | structured-data | |
| semantic-lists | definition-elements | content-extraction | ALSO fold 9.6 `answer-readiness/numbered-steps` here (map: evidence duplicates semantic-lists) — numbered-steps' v1 row was a `move`; add a migration-map note field recording the late fold; its id flips to `renamed` → `content-extraction/semantic-lists` |
| server-responsiveness (also `TODO(rewrite)`) | fast-response-time | content-extraction | rewrite per header: median TTFB, banded |
| form-actionability | webmcp-input-quality | operability-safety | |
| landmark-unique | nav-aria-label | operability-safety | |

- [ ] Same recipe (5 folds incl. the 9.6 extra). Registry 155 → 149. Full gates. After this task: `migration-map.json` has ZERO `merging` entries.

---

### Task 9: Splits — 3.8 and 5.23

- [ ] `structured-data/service-product-schema.ts` → rename (git mv) to `structured-data/service-schema.ts`, id `structured-data/service-schema`, narrowed to Service/ProfessionalService only; move the Product-shape checks into `structured-data/advanced-product-details.ts` (extend its tests); dossier renamed + updated, migration-map 3.8 `to` → `structured-data/service-schema` + note about the Product half.
- [ ] `agent-interfaces/webmcp-tool-naming.ts`: naming rule folds into `agent-interfaces/openapi-operation-ids` (extend that audit + tests); runtime part deferred (record in dossier); delete file; dossier → merged/; migration-map 5.23 → `renamed`, `to: agent-interfaces/openapi-operation-ids`. Registry 149 → 148.
- [ ] Full gates. Commit `feat(core)!: execute the service-schema and tool-naming splits`.

---

### Task 10: Rewrites — agent-interfaces catalog + WebMCP (5 files)

Requirement source per file = its `TODO(redeem)` header + linked dossier "Required rework". TDD per rewrite: new failing tests for the corrected pass-conditions first.

- [ ] `ai-catalog-exists` — ARD §4.1 shape (specVersion + host + entries[]), replace invented `services` array; guidance/code samples to real schema.
- [ ] `ai-catalog-metadata` — check real ARD metadata fields (dossier names them).
- [ ] `ai-catalog-urls` — liveness of manifest-listed endpoints per ARD.
- [ ] `webmcp-declarative-forms` — align to the W3C explainer/Baseline `declarative-webmcp` attribute names (WPT-backed).
- [ ] `webmcp-registered-tools` — replace manifest-file check with registered-tools detection per Lighthouse 13.3 precedent; stays `tier: 'experimental'`, weight 0; RENAME class `WebmcpManifestAudit` → `WebmcpRegisteredToolsAudit`.
- [ ] Update dossiers (grades per REWORK-TODO), drop the executed entries from REWORK-TODO.md. Full gates. Commit `feat(core)!: rewrite agent catalog + WebMCP audits to real specs`.

---

### Task 11: Rewrites — access-crawl-control + content signals (5 files)

- [ ] `access-crawl-control/sensitive-paths` — surgery per dossier (RFC 9309 path semantics, vendor-documented Disallow examples).
- [ ] `access-crawl-control/ai-content-declaration` — check the REAL directive names (noai/noimageai/tdm-reservation); stays experimental/weight 0.
- [ ] `access-crawl-control/tdm-rep` — fix internal incoherence; flip tier `informative` → `experimental` (REWORK-TODO target; weight stays 0).
- [ ] `content-extraction/aside-element` — mechanism verbatim-correct per dossier; fix what the TODO(redeem) header lists; drop stale `deletions/` pointer comments.
- [ ] `answer-readiness/trust-signals` — rebuild on the GEO-benchmark evidence per dossier.
- [ ] Dossiers + REWORK-TODO.md updated. Full gates. Commit `feat(core)!: rewrite crawl-control and content-signal audits per evidence`.

---

### Task 12: Rewrites — remaining redeems (4 files)

- [ ] `structured-data/speakable-schema` — page-type gate to news/article publishers; delete the Alexa/Siri claim.
- [ ] `operability-safety/form-error-messages` — aria-describedby/aria-errormessage linkage on invalid-state inputs.
- [ ] `answer-readiness/direct-definitions` — language-neutral structural detector; notApplicable without definitional intent.
- [ ] `agent-interfaces/cors-api-routes` — notApplicable unless a public API surface exists.
- [ ] Dossiers + REWORK-TODO.md: after this task the file lists ONLY deliberate deferrals (delete the stale `mobile-friendly` entry — audit sunset in Plan 3). Full gates. Commit `feat(core)!: rewrite form, definition and CORS audits`.

---

### Task 13: Gatherer adoption sweep — robots consumers

- [ ] Every access-crawl-control audit that parses robots.txt independently adopts the shared robots gatherer/`_robots-txt-helpers` path (list them by grepping for robots.txt parsing outside the helpers). Behavior-preserving; differential test: same fixtures, same results before/after.
- [ ] Full gates. Commit `refactor(core): robots consumers adopt the shared gatherer`.

---

### Task 14: Migration-map integrity + registry count pin

- [ ] `migration-map.test.ts`: assert `merging` count === 0 (or the exact deliberate-deferral count if any survived — name them); pin `renamed`+`removed` totals; keep 207 total; assert every `to` of renamed entries is registered OR documented-deferred (5.23's runtime part). Add `existsSync` on every surviving entry's dossier link (Plan-3 deferred).
- [ ] Registry-count assertion: `sunset.test.ts` floor updated to the final count (compute; expected 148) — assert exact count, not just floor.
- [ ] `node scripts/check-dossiers.mjs` green; also extend it (or a test) with the reverse check: every dossier under `docs/evidence/audits/` belongs to a registered audit (orphans moved to `docs/evidence/merged/` or `sunset/` — fixes the 18 pre-existing orphans by moving them under `docs/evidence/sunset/` where their duplicates live: reconcile, keep one copy).
- [ ] Full gates. Commit `test(core): pin v2 registry and migration-map end state`.

---

### Task 15: Changeset + docs + full verification

- [ ] Changeset (major already pending): add `.changeset/v2-merges-rewrites.md` — registry 181 → 148 via merges/splits/consolidations, every remaining audit rewritten to evidence-backed pass conditions, `_a11y.ts` split, migration-map all-renamed.
- [ ] Docs sweep (bounded): update audit counts in `README.md`, `packages/*/README.md`, `docs/BENCHMARK.md`, `docs/PROMOTION.md` to the final count; fix `docs/evidence/audits/README.md` stale link texts; leave `packages/website/` regeneration to Plan 6.
- [ ] Full gates: `pnpm test`, `pnpm typecheck`, `rtk err pnpm lint`, `npx changeset status`, `node scripts/check-dossiers.mjs`.
- [ ] Commit `docs: v2 merge wave release notes and count sweep`.

---

## Deliberate deferrals (Plan 6)

Tier badges + `--experimental` flag surfaces · website regeneration (`audits-data.json`, `index.html`, CATEGORY_ORDER sort) · `AuditMeta` optional-fields tightening · `buildCategoryResult` mass param · all-na category mass product decision · cli `--categories` wiring-or-removal · presets dead-config decision · guidance.tags sweep · 65-char id upper-bound test.
