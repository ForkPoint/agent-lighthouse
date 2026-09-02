# Architecture and test debt

This file holds unresolved work that has evidence but no implementation phase.
It is not a plan. A phase plan may take one row only after it re-measures the
claim. Closed work leaves this file and stays in Git history.

| # | debt | status on 2026-09-02 | next owner |
| -: | :--- | :------------------- | :--------- |
| 1 | Three WAF classifier defects | Open; current corpus pins the wrong kinds | Separate fix |
| 2 | Corpus skips accessibility results | Open | Test infrastructure |
| 3 | Scripts have no typecheck | Open | Build tooling |
| 4 | Corpus nightly is not reliable | Three scheduled runs failed | Nightly workflow |
| 5 | Four smaller test and API debts | Open | Separate cleanup |
| 6 | Text-rich HTTP 200 walls produce wrong verdicts | Open | Hostile-state contract extension |

The hostile-state branch first recorded these items. The sections below retain
the evidence needed to start each fix.

## 1. Three WAF-detector defects found by the corpus

In `packages/core/src/waf-detector.ts`:

- The Kasada branch matches the substring `k-challenge`, so `vercel.com/pricing`
  — which serves `text/markdown` to the scanner user agent, that is, does the
  right thing — is reported as a bot wall because its copy links
  `/changelog/...attack-challenge-mode`.
- The PerimeterX branch matches `_pxAppId` in the body, which every PerimeterX
  customer's ordinary pages carry, not only challenges (`walmart.com/help`).
- A genuine Akamai soft block served at HTTP 200 reads as a readable page: the
  Akamai branch is gated on `status === 403 || scannedPagesCount === 0`
  (`tirerack.com`).

`docs/evidence/corpus.md` records which fixtures' recorded `kind` must be
re-recorded when these are fixed.

## 2. The corpus never exercises the accessibility audits

About 17 audits are `notApplicable` on all 41 fixtures because `page.a11yResults`
is populated only by the orchestrator. Wiring the a11y runner into the corpus
harness needs its own runtime budget — the suite already sits at 75–99 s against
a 120 s cap.

## 3. No script in the repository is typechecked

The root `tsconfig.json` includes only `packages/*/src/**/*` and `pnpm typecheck`
runs per package, so everything under `scripts/` is outside every include.
Obsolete one-time scripts (`analyze-false-positives.ts`, `analyze-stores.ts`, and
`investigate-stores.ts`) were pruned; remaining scripts should eventually be
included under a dedicated tsconfig or typecheck pass.

## 4. The nightly workflow runs, but it does not finish reliably

The workflow ran on schedule three times before this review. All three runs
failed. Run `33379094687` scanned 249 of its 400-site window, skipped 58 sites
because of robots.txt, and ran out of time with 93 sites unscanned. It also
reported schema violations on 45 sites. The prior 400-site / 240-minute budget
was therefore wrong.

The next plan must separate timeout capacity from result-schema defects. It
must define success for a partial window and preserve the uploaded summary on
failure.

## 5. Smaller items

- `MAX_CONCURRENT_REQUESTS` in `packages/core/src/constants.ts:10` is exported
  and referenced nowhere. Removing it is a published-API change.
- The `challenged-at-200` hostile state renders 58 characters, so it does not
  exercise a *text-bearing* 200 wall. `walmart-com-wall-200` covers that shape as
  a fixture but not as a contract state.
- `packages/core/src/tests/audit-sources.ts` duplicates about fifteen lines of
  `scripts/lib/requires-analysis.mjs`. Importing the `.mjs` breaks
  `pnpm typecheck`; both available fixes were ruled out.
- The corpus fixture harness hands every audit `allEvidenceMet()`, so the corpus
  can never exercise the evidence gate. The hostile-state suite is the only place
  those guards are proven.

## 6. A text-rich 200 bot wall still draws 28 wrong verdicts

An audit that reads only root files derives `requires: ['origin-reachable']`, so
it runs against a wall's files. None returns `pass` — the hostile-state suite
proves that — but on a bot wall served at HTTP 200 with the site's own template
around it, 28 audits emit a wrong non-`notApplicable` verdict. `sitemap-exists`
fails at weight 1.0, `sitemap-lastmod` warns at 1.0, the four `openapi-*` audits
fail at 0.6 each, and 13 crawler-token audits warn "allowed by default" off a
robots.txt that answered HTML.

All 28 are pre-existing. Measured across the hostile-state branch: the
merge-base has 43 wrong non-`na` verdicts in that state, the branch has 30, and
the branch's set is a strict subset. It removed 13 and added none.

Two of the 28 sit inside `access-crawl-control` and were left unguarded on the
branch, on a justification that turned out to be false. Both reach a wrong
scored `fail` on a site-templated wall:

- `sensitive-paths`, weight 1.0 — harvests `<a href>` from the wall's own DOM
  (`sensitive-paths.ts:164-170`), and because robots.txt answered HTML the
  `hasRobots` guard at `:226` is false, so everything reads as crawlable. The
  wall supplies both the observed URLs and the reason robots.txt looks absent.
- `rsl-licensing-terms-conformance`, weight 0.6 — reports "1 problem(s) in this
  site's RSL licensing" off a `<link rel="license" type="application/rsl+xml">`
  in the same head fragment the branch guarded `canonical` for.

`machine-actionable-402-paid-access` is genuinely safe: a 200 wall never yields a
402 probe.

Fixing the class needs a second invariant that knows which audits must report the
wall rather than decline it. The nothing-obtained tier forbids only `pass`,
deliberately, because `fail` is correct when the wall is the finding.
