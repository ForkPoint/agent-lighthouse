# v2 restructure — handoff state (2026-08-23)

Continuation anchor for the next session. Read this first, then the ledgers.

## Where things stand

- Branch: `feat/v2-engine` (PR #10), pushed through `4cb9957` (Wave C); Plan 5b Wave D is committed locally and **not pushed** — the controller pushes after approval.
- Registry: **215 audits, 8 categories**, ids `category/slug`, evidence-mass scoring.
- Gates at HEAD: `pnpm test` 3376 passed / 0 failed / 239 skipped · `pnpm typecheck` clean · `rtk err pnpm lint` clean · `node scripts/check-dossiers.mjs` → "215 audits OK, no orphans" · `npx changeset status` all-major (core/report/cli/mcp → 2.0.0).
- migration-map.json: 207 entries — 26 removed, 181 renamed, **zero** merging/interim. `migration-map.test.ts` pins the census, extinction, dossier-link existence, registry cross-pin; `sunset.test.ts` pins the v1 roster; `new-in-v2.ts` carries the 67 ids added by Plans 5 and 5b.
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
| 5b Wave B — grade-B graduation | `docs/superpowers/plans/2026-08-23-v2-graduate-grade-b-wave-b.md` | complete — 9 audits graduated (4 `content-extraction`, 5 `answer-readiness`) and 3 proposals folded into shipped audits, registry 184 → 193, commits `af9a654..fba7c75` (plan doc `6bacd41`) |
| 5b Wave C — grade-B graduation | `docs/superpowers/plans/2026-08-23-v2-graduate-grade-b-wave-c.md` | complete — 10 audits graduated (5 `access-crawl-control`, 5 `machine-discovery`) and 1 proposal folded, registry 193 → 203, commits `23915ff..4cb9957` |
| 5b Wave D — grade-B graduation | `docs/superpowers/plans/2026-08-23-v2-graduate-grade-b-wave-d.md` | complete — 12 audits graduated (6 `operability-safety`, 3 `agent-interfaces`, 3 `agentic-commerce`) and 1 proposal folded, registry 203 → 215, commits `d373622..HEAD`. **Plan 5b is finished.** |

Ledgers (Plan 6 consumed their deferral lists and marked both; keep as the record of what was found):
- `.superpowers/sdd/2026-08-21-v2-taxonomy/progress.md`
- `.superpowers/sdd/2026-08-22-v2-merges-rewrites/progress.md`

## Remaining scope

### Plan 5b — graduate the remaining grade-B proposals
Source: `packages/core/src/audits/proposed/` (**4 stubs left**, none registered) + `docs/evidence/proposals/`.
- **Plan 5b is complete.** All four waves are done; every feasible stub has graduated. The four that remain are blocked, not skipped — each is named below with its blocker.
- Grade B → scored tier at `weightForGrade('B', 'scored')` = 0.6. Same tier law otherwise.
- Intended grouping for the rest (user chose the four-wave split):
  - ~~**Wave B** — token-economics (7) + answer-selection-forensics (5)~~ done: 9 graduated, 3 folded into `content-extraction/token-ratio`, `content-extraction/svg-bloat` and `content-extraction/markdown-alternate`; `answer-selection-forensics/question-heading-answer-span-alignment` stays a stub (grade C, `llm-assisted`)
  - ~~**Wave C** — feeds-indexing (5) + bot-auth-access (5) + `competitor-gap-verify/content-signal-coherence` (1)~~ done: 10 graduated, `competitor-gap-verify/content-signal-coherence` folded into `access-crawl-control/ai-usage-signal-coherence-across-channels`; six ids renamed to fit the 64-character cap in `schemas.ts`; the orphan half of `three-way-freshness-lag` was dropped because `machine-discovery/discovery-index-coverage` owns it
  - ~~**Wave D** — trust-provenance (6) + mcp-server-quality (3) + agentic-commerce (3) + `offer-dom-price-parity` (1)~~ done: 12 graduated, `competitor-gap-verify/offer-dom-price-parity` folded into `agentic-commerce/offer-truth-consistency`; the C2PA signer audit ships reduced (certificate status only, no trust-list membership) by user decision
- Still blocked on missing infra: **3**, all left as stubs.
  - `agent-operability/overlay-interception-hazard` — needs a headless browser: the hazard is an overlay that intercepts a click, which only exists once the page renders.
  - `answer-selection-forensics/question-heading-answer-span-alignment` — `llm-assisted`, grade C.
  - `mcp-server-quality/behavior-annotation-coverage-and-claim-consistency` — `llm-assisted`: judging whether a tool's annotations match what its description claims needs a model, and the deterministic half is already covered by `agent-interfaces/mcp-tool-contract-validity` and `agent-interfaces/mcp-tool-description-coverage`.
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
- Shared modules added by Wave C, to reuse rather than duplicate:
  `gatherers/feeds.ts` (`sharedFeed`, `sharedFeeds`, `discoverFeedUrls`,
  `parseFeed`, `parseFeedDate` — the strict date parser that returns
  `undefined` for a timezone-less value rather than guessing an offset),
  `gatherers/conditional.ts` (`sharedRevalidation`),
  `gatherers/structured-fields.ts` (`parseDictionary`, `parseLinkHeader`,
  `linksWithRel`), `gatherers/currency.ts` (`isIso4217`),
  `gatherers/robots.ts` (`directiveLines`), and `gatherers/ua-parity.ts`
  gained `baselineHeaders`/`probeHeaders` on `UaProbe`.
- **Audit ids are capped at 64 characters** by `packages/core/src/schemas.ts`.
  Six Wave C proposals needed a shorter slug; each rename is recorded under
  `## Implementation deviations` in its dossier. Check the id length before
  writing the meta block.
- **A `fail()`/`warn()` fourth argument may be a priority token or a
  remediation sentence.** Thirty-two call sites passed a sentence, which threw
  a `ZodError` at report time; `Audit.splitRecommendation` now accepts both and
  `AuditResult.remediation` carries the sentence. Unit tests call
  `audit.audit(ctx)` directly and never see `toCheckResult`, so this class of
  defect only shows in a full scan — watch for `[scanner] Audit error` in the
  test output.
- **`details` values must be scalars or an array of strings.** A number array
  is dropped whole by the result schema, which is how
  `answer-readiness/section-split-risk-profile` lost `sectionTokens` until Wave
  C fixed it.
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

- Shared modules added by Wave D, to reuse rather than duplicate:
  `gatherers/media.ts` (`imageCandidates`, `fetchImage`, `findC2paManifest`,
  `extractXmp`, `originOfVariant` — container parsers for JPEG, PNG, WebP and
  BMFF), `gatherers/commerce.ts` (`parseAmount`, `productRegion`,
  `priceCandidates`, `offerNodes`, `platformFingerprint`, `CURRENCY_SYMBOLS`,
  `OUT_OF_STOCK_PHRASES`), `gatherers/domains.ts` (`registrableDomain`,
  `registrableOf`), `_mcp-client.ts` gained `listTools` (shared `tools/list`
  read), and `gatherers/ua-parity.ts` gained `sharedUaFetch` for an audit that
  needs the response body rather than only the status.
- **The fetcher can read bytes.** `fetch({ binary: true })` returns
  `result.bytes` instead of decoding: a UTF-8 decode replaces every invalid
  sequence with U+FFFD, which destroys image metadata. Only the media gatherer
  uses it.
- **The mis-pasted Evidence block is systemic, not a Wave B accident.** Both
  `mcp-server-quality` dossiers graduated in Wave D carried evidence about
  accessibility trees and Playwright actionability, neither of which touches
  the MCP registry or tool metadata. Each mismatch is now recorded under
  `## Implementation deviations` in the graduated dossier rather than silently
  fixed. Check the Evidence section against the mechanism paragraph before
  graduating anything.
