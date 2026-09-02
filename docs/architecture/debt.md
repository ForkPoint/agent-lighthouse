# Architecture and test debt

This file holds unresolved work that has evidence but no implementation phase.
It is not a plan. A phase plan may take one row only after it re-measures the
claim. Closed work leaves this file and stays in Git history.

| # | debt | status on 2026-09-02 | next owner |
| -: | :--- | :------------------- | :--------- |
| 1 | Corpus skips accessibility results | Open | Test infrastructure |
| 2 | Corpus nightly is not reliable | Three scheduled runs failed | Nightly workflow |
| 3 | Three smaller test and API debts | Open | Separate cleanup |
| 4 | Text-rich HTTP 200 walls produce wrong verdicts | In progress; sensitive-paths & RSL resolved | Hostile-state contract extension |

The hostile-state branch first recorded these items. The sections below retain
the evidence needed to start each fix.

## 1. The corpus never exercises the accessibility audits

About 17 audits are `notApplicable` on all 41 fixtures because `page.a11yResults`
is populated only by the orchestrator. Wiring the a11y runner into the corpus
harness needs its own runtime budget — the suite already sits at 75–99 s against
a 120 s cap.

## 2. The nightly workflow runs, but it does not finish reliably

The workflow ran on schedule three times before this review. All three runs
failed. Run `33379094687` scanned 249 of its 400-site window, skipped 58 sites
because of robots.txt, and ran out of time with 93 sites unscanned. It also
reported schema violations on 45 sites. The prior 400-site / 240-minute budget
was therefore wrong.

The next plan must separate timeout capacity from result-schema defects. It
must define success for a partial window and preserve the uploaded summary on
failure.

## 3. Smaller items

- The `challenged-at-200` hostile state renders 58 characters, so it does not
  exercise a *text-bearing* 200 wall. `walmart-com-wall-200` covers that shape as
  a fixture but not as a contract state.
- `packages/core/src/tests/audit-sources.ts` duplicates about fifteen lines of
  `scripts/lib/requires-analysis.mjs`. Importing the `.mjs` breaks
  `pnpm typecheck`; both available fixes were ruled out.
- The corpus fixture harness hands every audit `allEvidenceMet()`, so the corpus
  can never exercise the evidence gate. The hostile-state suite is the only place
  those guards are proven.

## 4. Text-rich 200 bot wall verdicts

An audit that reads only root files derives `requires: ['origin-reachable']`, so
it runs against a wall's files. None returns `pass` — the hostile-state suite
proves that — but on a bot wall served at HTTP 200 with the site's own template
around it, remaining root-file audits can emit non-`notApplicable` verdicts:
`sitemap-exists` fails at weight 1.0, `sitemap-lastmod` warns at 1.0, the four
`openapi-*` audits fail at 0.6 each, and 13 crawler-token audits warn "allowed by default"
off a robots.txt that answered HTML.

The two scored `fail` audits inside `access-crawl-control` (`sensitive-paths` at weight 1.0
and `rsl-licensing-terms-conformance` at weight 0.6) have been resolved by requiring
`unblocked-fetches`.

`machine-actionable-402-paid-access` is genuinely safe: a 200 wall never yields a
402 probe.

Addressing the remaining root-file checks can be handled in a dedicated root-file
contract extension that scopes root files to `unblocked-fetches`.
