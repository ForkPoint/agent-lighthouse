# Follow-ups from the hostile-state testing branch

The branch `test/hostile-state-contract` added a hostile-state contract suite, a
real-page corpus and a nightly job. Along the way it surfaced defects it
deliberately did not fix, because each needs a decision or a budget of its own.
This file is the record so none of them is rediscovered from scratch.

## 1. Four OpenAPI audits fail a site for an absence

`agent-interfaces/openapi-servers`, `openapi-endpoints`, `openapi-schemas` and
`openapi-operation-ids` are grade B, tier `scored`, weight 0.6 each — 2.4
combined. Each returns `fail` at `priority: 'high'` on every site with no
OpenAPI spec, on all 41 corpus fixtures. `openapi-exists`, for the identical
absence, returns `notApplicable` and is informative at weight 0.

This contradicts the repository's own rule: absence is `notApplicable`, not
`fail`. Worse, the `openapi-servers` dossier's own counter-evidence argues the
reachability leg has no documented consumer and that an absent servers array is
legal under OpenAPI 3.1. It never documents failing on a wholly absent spec.
Where dossier and code disagree, the dossier governs.

Not the same defect, and out of scope for the fix: the always-fail
`machine-discovery` siblings (`sitemap-exists`, `sitemap-lastmod`,
`sitemap-absolute-urls`, `rss-feed`) fail on the corpus only because the fixture
harness supplies no root files. A real scan fetches `/sitemap.xml`.

Needs: a policy decision, then a `major` changeset.

## 2. Three WAF-detector defects found by the corpus

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

## 3. The corpus never exercises the accessibility audits

About 17 audits are `notApplicable` on all 41 fixtures because `page.a11yResults`
is populated only by the orchestrator. Wiring the a11y runner into the corpus
harness needs its own runtime budget — the suite already sits at 75–99 s against
a 120 s cap.

## 4. Three latent content-into-selector sites

Page content is interpolated into a CSS selector without escaping at
`packages/core/src/parser.ts:471`, and
`packages/core/src/audits/operability-safety/hover-only-content-and-navigation.ts:154`
and `:188`. An `id` containing a double quote makes cheerio throw
`Attribute selector didn't terminate`. `parser.ts:471` is inside `extractForms`,
so one quoted id turns both `forms-no-js` and `contact-form` into `scan-error`
stubs. `escapeAttrValue` (`form-actionability.ts:128`) and `cssEscape`
(`form-autofill-token-coverage.ts:110`) already exist in the same category.

The same class already shipped once: `extractor-survival-recall` interpolated a
JSON-LD title into `:contains()` and threw on a gov.uk page. Fixed on this
branch.

## 5. No script in the repository is typechecked

The root `tsconfig.json` includes only `packages/*/src/**/*` and `pnpm typecheck`
runs per package, so everything under `scripts/` is outside every include. Two
scripts are already type-broken: `analyze-false-positives.ts:33` and
`investigate-stores.ts:38`. The branch added three more scripts that are clean
today with nothing keeping them so.

## 6. The nightly workflow has never run against Actions

`.github/workflows/corpus-nightly.yml` is unproven end to end. CI covers only the
`--limit=0` wiring path. Before enabling the schedule, dispatch it once at
`--limit=50` and read the artifact. The 400-site / 240-minute budget rests on a
four-site measurement.

Related: the site-level robots gating added late in the branch will raise the
`skipped` count, by how much is untested against the real list.

## 7. Smaller items

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

## 8. A text-rich 200 bot wall still draws 28 wrong verdicts

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

## 9. `pnpm test` is not offline-safe, and `AL_SKIP_NETWORK=1` no longer means what CLAUDE.md says

`isSafeUrl()` calls `dns.lookup`, and the corpus suite reaches it through
`root-text-file-resolution-integrity` and `reflected-parameter-injection-canary`.
`pnpm test` now makes about 2065 `dns.lookup` calls against real public
hostnames — `www.barclays.co.uk`, `lobste.rs`, `www.chase.com`, `www.irs.gov` —
where before the corpus landed it made about 390 against reserved names.

With name resolution failing, 54 tests in 3 files go red, including all 41 corpus
snapshots, because those two audits flip to `notApplicable` when `isSafeUrl`
fails closed. CI with DNS is green.

Nothing reaches the published package and no HTTP request is made. But
`CLAUDE.md` advertises `AL_SKIP_NETWORK=1` as the offline path, and that is now
inaccurate. The golden snapshot is also hostage to live global DNS.
