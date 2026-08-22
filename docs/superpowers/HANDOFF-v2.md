# v2 restructure — handoff state (2026-08-22)

Continuation anchor for the next session. Read this first, then the ledgers.

## Where things stand

- Branch: `feat/v2-engine`, pushed through `9147325` (PR #10). Working tree clean.
- Registry: **148 audits, 8 categories**, ids `category/slug`, evidence-mass scoring.
- Gates at HEAD: `pnpm test` 2156 passed / 0 failed · `pnpm typecheck` clean · `rtk err pnpm lint` clean · `node scripts/check-dossiers.mjs` → "148 audits OK, no orphans" · `npx changeset status` all-major (core/report/cli/mcp → 2.0.0).
- migration-map.json: 207 entries — 26 removed, 181 renamed, **zero** merging/interim. `migration-map.test.ts` pins the census, extinction, dossier-link existence, registry cross-pin; `sunset.test.ts` pins exact 148.
- Zero `TODO(redeem)` / `TODO(merge)` / `TODO(rewrite)` markers left in live audit code. `REWORK-TODO.md` is all `[x] DONE`.

## Executed plans

| Plan | File | State |
| :-- | :-- | :-- |
| 3 — v2 taxonomy | `docs/superpowers/plans/2026-08-21-v2-taxonomy.md` | complete (181 audits, map, CI dossier check) |
| 4 — merges/rewrites | `docs/superpowers/plans/2026-08-22-v2-merges-rewrites.md` | complete + final review + fix wave |
| — redeem wave | (no plan file; user-approved 2026-08-22) | 6 audits redeemed, commits `1681037..dc430d4` + `9147325` |

Ledgers (KEEP — Plan 6 consumes their deferral lists):
- `.superpowers/sdd/2026-08-21-v2-taxonomy/progress.md`
- `.superpowers/sdd/2026-08-22-v2-merges-rewrites/progress.md`

## Remaining scope

### Plan 5 — graduate proposed audits (not yet written)
Source: `packages/core/src/audits/proposed/` (83 stubs, none registered) + `docs/evidence/proposals/`.
- Feasible now: **77** (53 `static-fetch`, 24 `multi-page`).
- Blocked on missing infra: **6** (2 `headless-browser`, 4 `llm-assisted`) — leave as stubs.
- Open decision (ask user): the 5 competitor-gap-verify "tool survey" stubs (Otterly/Peec, Semrush suites, Lighthouse agentic category, GitHub generators, Profound) are research about tools, not site checks — graduate as informative vs archive as research.
- Domain → category map (spec line 92): agentic-commerce→agentic-commerce · mcp-server-quality→agent-interfaces · agent-operability/injection-safety/trust-provenance→operability-safety · token-economics→content-extraction · bot-auth-access→access-crawl-control · answer-selection-forensics→answer-readiness · feeds-indexing→machine-discovery · competitor-gap-verify distributes by check.
- Spec says land in waves, grade A first. Tier law: A/B→scored, C→informative (weight 0), experimental→weight 0; weight-0 ⇒ `scoreDisplayMode: 'informative'`.
- Prerequisite for the two Content-Signal checks: robots gatherer must retain non-rule directive lines per group (Task 13 note).
- Graduation recipe per stub: implement per header sketch + proposal dossier, register in category array, move dossier `docs/evidence/proposals/<domain>/` → `docs/evidence/audits/<category>/` with frontmatter (`slug`, `evidence_grade`, `audit:`), registry count grows, `check-dossiers` + `sunset.test.ts` exact-count updated per wave, changeset at the end.

### Plan 6 — polish + backlog (not yet written)
From Plan 4's "Deliberate deferrals" + both ledgers:
- Tier badges + `--experimental` flag surfaces.
- Website regeneration: `packages/website/audits-data.json` + `index.html` are 207-era stale (carry deleted claims); no generator script exists — build one or regenerate by hand.
- Latent bugs (all documented in ledger): `AuditResultSchema` strips unknown `details` keys · `Audit.fail()/warn()` discard `recommendation.code` (workaround: `details.code`) · `fetcher.ts:170-175` drops repeated headers (breaks `X-Robots-Tag`/`Link` canonical/doubled `nosniff`) · `isSafeUrl` gate does not survive fetcher's 5 redirects.
- `AuditMeta` optional-fields tightening · `buildCategoryResult` mass param · all-na category mass decision · cli `--categories` wiring-or-removal · presets dead-config decision · guidance.tags sweep · 65-char id upper-bound test.
- Deferred minors: every `minor (deferred)` line in both ledgers. Priority item: `meta-description.ts:97` brand-only-title warn (audit sits in the content readiness vital).

### Endgame
- **Squash-merge PR #10** when v2 work completes (user decision — `.lavish/`/`.playwright-mcp/` blobs exist in branch history and must not reach main).

## Session constraints (carry over)

- SDD process: opus implementers, sonnet task reviewers, haiku scoped re-reviews, most-capable final reviewer; per-plan workspace `.superpowers/sdd/<plan-basename>/`; BASE recorded before each dispatch; implementers never push — controller pushes after user approval; user decisions via AskUserQuestion.
- Tests from repo root `pnpm test <path>`; never `npx tsc -b`; `pnpm typecheck`; lint only via `rtk err pnpm lint`; oxlint only, never ESLint.
- Meta law: `weight = weightForGrade(grade, tier)` — A→1.0, B→0.6, C/D→0; non-scored tiers ⇒ weight 0 + `scoreDisplayMode: 'informative'`; grade C in scored tier is unregistrable. Grade = strongest PROVEN consumer path; dossier governs.
- New URL fetches must be `isSafeUrl()`-gated; test suites `vi.mock` the fetcher (no real DNS).
- Never commit `.lavish/` or `.playwright-mcp/` (gitignored). One audit = one file + one dossier.
- Watch for stale build artifacts: untracked `.js`/`.d.ts` under `packages/*/src/` shadow sources in vitest (Task 9 incident) — check before trusting local greens.
