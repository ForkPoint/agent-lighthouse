# v2 restructure — handoff state (2026-08-23)

Continuation anchor for the next session. Read this first, then the ledgers.

## Where things stand

- Branch: `feat/v2-engine` (PR #10), fully pushed at `e4a4e13`. Working tree clean, nothing local.
- Registry: **172 audits, 8 categories**, ids `category/slug`, evidence-mass scoring.
- Gates at HEAD: `pnpm test` 2693 passed / 0 failed / 172 skipped · `pnpm typecheck` clean · `rtk err pnpm lint` clean · `node scripts/check-dossiers.mjs` → "172 audits OK, no orphans" · `npx changeset status` all-major (core/report/cli/mcp → 2.0.0).
- migration-map.json: 207 entries — 26 removed, 181 renamed, **zero** merging/interim. `migration-map.test.ts` pins the census, extinction, dossier-link existence, registry cross-pin; `sunset.test.ts` pins the v1 roster; `new-in-v2.ts` carries the 24 ids added by Plan 5.
- Zero `TODO(redeem)` / `TODO(merge)` / `TODO(rewrite)` markers left in live audit code. `REWORK-TODO.md` is all `[x] DONE`.

## Executed plans

| Plan | File | State |
| :-- | :-- | :-- |
| 3 — v2 taxonomy | `docs/superpowers/plans/2026-08-21-v2-taxonomy.md` | complete (181 audits, map, CI dossier check) |
| 4 — merges/rewrites | `docs/superpowers/plans/2026-08-22-v2-merges-rewrites.md` | complete + final review + fix wave |
| — redeem wave | (no plan file; user-approved 2026-08-22) | 6 audits redeemed, commits `1681037..dc430d4` + `9147325` |
| 5 — grade-A graduation | `docs/superpowers/plans/2026-08-22-v2-graduate-grade-a.md` | complete — 24 audits graduated, registry 148 → 172, commits `2bb2506..32955d4` |
| 6 — polish + backlog | `docs/superpowers/plans/2026-08-23-v2-polish-backlog.md` | complete — 15 tasks, commits `16a4662..e4a4e13`. What it deliberately did not fix is listed under "Triage record" in that file |

Ledgers (Plan 6 consumed their deferral lists and marked both; keep as the record of what was found):
- `.superpowers/sdd/2026-08-21-v2-taxonomy/progress.md`
- `.superpowers/sdd/2026-08-22-v2-merges-rewrites/progress.md`

## Remaining scope

### Plan 5b — graduate the 45 grade-B proposals (not yet written)
Source: `packages/core/src/audits/proposed/` (**52 stubs left**, none registered) + `docs/evidence/proposals/`.
- Grade B → scored tier at `weightForGrade('B', 'scored')` = 0.6. Same tier law otherwise.
- Feasible now: the 44 grade-B stubs outside the infra-blocked set (45 minus the Lighthouse-ARD survey archived in Plan 5 Task 2).
- Still blocked on missing infra: **6** (2 `headless-browser`, 4 `llm-assisted`) — leave as stubs.
- Two grade-A stubs deliberately left behind by Plan 5, to be picked up when their blocker clears:
  - `agentic-commerce/acp-endpoint-conformance-probe` (grade A, informative) — ACP defines no discovery mechanism, so the audit needs an operator-supplied base URL. `ScanOptions`, the CLI flag set and the MCP tool schema would all have to grow one; that plumbing was not built: Plan 6 shipped `--categories` and `--experimental`, but no operator-supplied base URL.
  - `agent-operability/overlay-interception-hazard` (grade A, headless-browser) — one of the 6 infra-blocked stubs.
- Domain → category map (unchanged): agentic-commerce→agentic-commerce · mcp-server-quality→agent-interfaces · agent-operability/injection-safety/trust-provenance→operability-safety · token-economics→content-extraction · bot-auth-access→access-crawl-control · answer-selection-forensics→answer-readiness · feeds-indexing→machine-discovery · competitor-gap-verify distributes by check.
- Graduation recipe (proven across 24 audits in Plan 5): read the stub header sketch + the proposal dossier (dossier governs on conflict) → write the failing test → implement → register in the category index (export, import, array — same order) → `git mv` the dossier into `docs/evidence/audits/<category>/<slug>.md` and rewrite its frontmatter to the audit shape → append the id to `NEW_IN_V2` in `packages/core/src/tests/new-in-v2.ts` → `git rm` the stub and decrement the counts in both `packages/core/src/audits/proposed/README.md` and `docs/evidence/proposals/README.md` → all four gates (`pnpm test`, `pnpm typecheck`, `rtk err pnpm lint`, core build + `node scripts/check-dossiers.mjs`) → commit locally. Record every substitution under `## Implementation deviations` and every skipped sketch step under `## Deferred` in the dossier. One changeset at the end of the wave.
- Shared gatherers Plan 5 built, reuse rather than duplicate: `gatherers/robots.ts` (`decidingRule`, `hasNamedGroup`), `gatherers/sitemap.ts` (`siteSitemapTree`, per-scan cached), `gatherers/sampled-pages.ts` (`fetchSampledPage`, per-scan cached), `gatherers/ua-parity.ts` (`sharedUaProbes`), `audits/agent-interfaces/_mcp-client.ts` (`discoverMcpEndpoint`, `postRpcRaw`, `mcpFetch`, `sharedProbe`, `discoverProbe`).
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
