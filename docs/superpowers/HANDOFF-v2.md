# v2 restructure — handoff state (2026-08-23)

Continuation anchor for the next session. Read this first, then the ledgers.

## Where things stand

- Branch: `feat/v2-engine` (PR #10), pushed through `c84ce54` (Wave A); Plan 5b Wave B is committed locally and **not pushed** — the controller pushes after approval.
- Registry: **193 audits, 8 categories**, ids `category/slug`, evidence-mass scoring.
- Gates at HEAD: `pnpm test` 2982 passed / 0 failed / 217 skipped · `pnpm typecheck` clean · `rtk err pnpm lint` clean · `node scripts/check-dossiers.mjs` → "193 audits OK, no orphans" · `npx changeset status` all-major (core/report/cli/mcp → 2.0.0).
- migration-map.json: 207 entries — 26 removed, 181 renamed, **zero** merging/interim. `migration-map.test.ts` pins the census, extinction, dossier-link existence, registry cross-pin; `sunset.test.ts` pins the v1 roster; `new-in-v2.ts` carries the 45 ids added by Plans 5 and 5b.
- Zero `TODO(redeem)` / `TODO(merge)` / `TODO(rewrite)` markers left in live audit code. `REWORK-TODO.md` is all `[x] DONE`.

## Executed plans

| Plan | File | State |
| :-- | :-- | :-- |
| 3 — v2 taxonomy | `docs/superpowers/plans/2026-08-21-v2-taxonomy.md` | complete (181 audits, map, CI dossier check) |
| 4 — merges/rewrites | `docs/superpowers/plans/2026-08-22-v2-merges-rewrites.md` | complete + final review + fix wave |
| — redeem wave | (no plan file; user-approved 2026-08-22) | 6 audits redeemed, commits `1681037..dc430d4` + `9147325` |
| 5 — grade-A graduation | `docs/superpowers/plans/2026-08-22-v2-graduate-grade-a.md` | complete — 24 audits graduated, registry 148 → 172, commits `2bb2506..32955d4` |
| 6 — polish + backlog | `docs/superpowers/plans/2026-08-23-v2-polish-backlog.md` | complete — 15 tasks, commits `16a4662..e4a4e13`. What it deliberately did not fix is listed under "Triage record" in that file |
| 5b Wave A — grade-B graduation | `docs/superpowers/plans/2026-08-23-v2-graduate-grade-b-wave-a.md` | complete — 12 audits graduated into `operability-safety`, registry 172 → 184, commits `c310763..9b443f0` (plan doc `853a8d9`) |
| 5b Wave B — grade-B graduation | `docs/superpowers/plans/2026-08-23-v2-graduate-grade-b-wave-b.md` | complete — 9 audits graduated (4 `content-extraction`, 5 `answer-readiness`) and 3 proposals folded into shipped audits, registry 184 → 193, commits `af9a654..HEAD` (plan doc `6bacd41`) |

Ledgers (Plan 6 consumed their deferral lists and marked both; keep as the record of what was found):
- `.superpowers/sdd/2026-08-21-v2-taxonomy/progress.md`
- `.superpowers/sdd/2026-08-22-v2-merges-rewrites/progress.md`

## Remaining scope

### Plan 5b — graduate the remaining grade-B proposals
Source: `packages/core/src/audits/proposed/` (**28 stubs left**, none registered) + `docs/evidence/proposals/`.
- Waves A and B are done. **24 feasible stubs remain across Waves C and D**, plus 3 infra-blocked and 1 deferred on the operator base URL.
- Grade B → scored tier at `weightForGrade('B', 'scored')` = 0.6. Same tier law otherwise.
- Intended grouping for the rest (user chose the four-wave split):
  - ~~**Wave B** — token-economics (7) + answer-selection-forensics (5)~~ done: 9 graduated, 3 folded into `content-extraction/token-ratio`, `content-extraction/svg-bloat` and `content-extraction/markdown-alternate`; `answer-selection-forensics/question-heading-answer-span-alignment` stays a stub (grade C, `llm-assisted`)
  - **Wave C** — feeds-indexing (5) + bot-auth-access (5) + `competitor-gap-verify/content-signal-coherence` (1)
  - **Wave D** — trust-provenance (6) + mcp-server-quality (3) + agentic-commerce (3) + `offer-dom-price-parity` (1)
- Still blocked on missing infra: **3** (1 `headless-browser` — `agent-operability/overlay-interception-hazard`, left behind by Wave A; 2 `llm-assisted`) — leave as stubs.
- Deferred on plumbing, not on evidence: `agentic-commerce/acp-endpoint-conformance-probe` (grade A, informative) — ACP defines no discovery mechanism, so the audit needs an operator-supplied base URL. `ScanOptions`, the CLI flag set and the MCP tool schema would all have to grow one; Plan 6 shipped `--categories` and `--experimental`, but no base-URL flag.
- Domain → category map (unchanged): agentic-commerce→agentic-commerce · mcp-server-quality→agent-interfaces · agent-operability/injection-safety/trust-provenance→operability-safety · token-economics→content-extraction · bot-auth-access→access-crawl-control · answer-selection-forensics→answer-readiness · feeds-indexing→machine-discovery · competitor-gap-verify distributes by check.
- Graduation recipe (proven across 36 audits in Plans 5 and 5b): read the stub header sketch + the proposal dossier (dossier governs on conflict) → write the failing test → implement → register in the category index (export, import, array — same order) → `git mv` the dossier into `docs/evidence/audits/<category>/<slug>.md` and rewrite its frontmatter to the audit shape → append the id to `NEW_IN_V2` in `packages/core/src/tests/new-in-v2.ts` → `git rm` the stub and decrement the counts in both `packages/core/src/audits/proposed/README.md` and `docs/evidence/proposals/README.md` → all four gates (`pnpm test`, `pnpm typecheck`, `rtk err pnpm lint`, core build + `node scripts/check-dossiers.mjs`) → commit locally. Record every substitution under `## Implementation deviations` and every skipped sketch step under `## Deferred` in the dossier. One changeset and one website regeneration (`npx tsx scripts/build-docs-data.ts`) at the end of each wave, not per audit.
- Shared gatherers to reuse rather than duplicate: `gatherers/robots.ts` (`decidingRule`, `hasNamedGroup`), `gatherers/sitemap.ts` (`siteSitemapTree`), `gatherers/sampled-pages.ts` (`fetchSampledPage`), `gatherers/css-rules.ts` (`collectPageCss`, `parseCssRules`), `gatherers/pages.ts` (`pagesOfType`), `gatherers/ua-parity.ts` (`sharedUaProbes`, and `sharedControlProbe` added by Wave A), `audits/operability-safety/_agent-affordances.ts` (`hasClickSignal`, `accessibleName`, `STATE_CLASS_RE`, `CLICKABILITY_CLASS_RE`), `audits/operability-safety/invisible-instruction-scan.ts` (`INSTRUCTION_LEXICON`), `audits/agent-interfaces/_mcp-client.ts` (`discoverMcpEndpoint`, `postRpcRaw`, `mcpFetch`, `sharedProbe`, `discoverProbe`).
- **Proposal dossiers carry a mis-pasted evidence block.** Every
  `answer-selection-forensics` dossier read in Wave B listed the same MCP
  authorization, Lighthouse and WebSuite sources, none of which touch the check
  they sit under; the sources the mechanism paragraphs actually cite survive
  only as bare `S7`/`S8`/`S10`/`S11` labels with no index anywhere in the repo.
  Wave B rewrote the block for `site-wide-passage-uniqueness-ratio` and
  `table-markdown-round-trip-loss`. The dossiers of the other Wave B
  graduations, and every remaining proposal, still carry it — check the
  Evidence section against the mechanism paragraph before graduating, and treat
  a mismatch as the dossier being wrong, not the audit.
- Shared modules added by Wave B, to reuse rather than duplicate:
  `gatherers/tokens.ts` (`countTokens`, `tokenBudget` — real `o200k_base`, never
  `chars / 4`), `gatherers/text-metrics.ts` (`normalizeText`, `wordCount`,
  `shingles`, `jaccard`, `sentences`), `gatherers/extraction.ts`
  (`readabilityArticle`, `semanticText`, `densityText`, `Extracted`).
  `sentences()` splits on terminal punctuation followed by whitespace *or* by a
  capital, because extractors concatenate block elements with no separator.
- Watch the scan budget: `verify-scan-results.test.ts` runs the whole registry against live sites at a 150s per-describe timeout, and the registry keeps growing. Share probes per scan rather than adding per-audit fetches.

### Endgame
- **Squash-merge PR #10** when v2 work completes (user decision — `.lavish/`/`.playwright-mcp/` blobs exist in branch history and must not reach main).

## Session constraints (carry over)

- SDD process: opus implementers, sonnet task reviewers, haiku scoped re-reviews, most-capable final reviewer; per-plan workspace `.superpowers/sdd/<plan-basename>/`; BASE recorded before each dispatch; implementers never push — controller pushes after user approval; user decisions via AskUserQuestion.
- Tests from repo root `pnpm test <path>`; never `npx tsc -b`; `pnpm typecheck`; lint only via `rtk err pnpm lint`; oxlint only, never ESLint.
- Meta law: `weight = weightForGrade(grade, tier)` — A→1.0, B→0.6, C/D→0; non-scored tiers ⇒ weight 0 + `scoreDisplayMode: 'informative'`; grade C in scored tier is unregistrable. Grade = strongest PROVEN consumer path; dossier governs.
- New URL fetches must be `isSafeUrl()`-gated; test suites `vi.mock` the fetcher (no real DNS).
- Never commit `.lavish/` or `.playwright-mcp/` (gitignored). One audit = one file + one dossier.
- Watch for stale build artifacts: untracked `.js`/`.d.ts` under `packages/*/src/` shadow sources in vitest (Task 9 incident) — check before trusting local greens.
