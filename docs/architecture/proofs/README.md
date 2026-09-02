# Proofs for `../pre-4.0.0-review.md`

One script per open finding. Each one reproduces the defect against the real
source in `packages/core/src` and prints what it measured, ending with a
`CONFIRMED:` line. Findings 1 and 2 are fixed and their scripts are gone; the
fixes are pinned by `packages/core/src/gatherers/cache-owner.test.ts`, the
"gatherer cache identity" case in `packages/core/src/audit-runner.test.ts`, and
the `--page-type` cases in `packages/cli/src/options.test.ts`.

Run one:

```bash
node --import tsx docs/architecture/proofs/f4-nullish.mts
```

Run all of them:

```bash
for f in docs/architecture/proofs/*.mts; do echo "== $f"; node --import tsx "$f"; done
```

`f3-originhomepage.mts` and `f11-conditions.mts` scan `https://example.com`
and need a network. The rest are offline.

These scripts describe behaviour as it stands before any fix. Once a finding is
fixed, its proof should fail — that is the point of keeping them. Delete a
script when its finding is closed and the fix has its own test.

| script                  | finding                                           |
| :---------------------- | :------------------------------------------------ |
| `f3-sitemap-break.mts`  | 3 — only the first declared sitemap is read       |
| `f4-nullish.mts`        | 4 — broken sitemap reported as absent             |
| `f3-originhomepage.mts` | 5 — origin homepage cached as `undefined`         |
| `f5-assessedmass.mts`   | 6 — `assessedMass` never set on the scan path     |
| `f9-samehost.mts`       | 7 — `sameHost` accepts a parent domain            |
| `f7-cachekey.mts`       | 8 — origin cache key ignores headers              |
| `f8-unbounded.mts`      | 9 — origin cache retains expired entries          |
| `f10-headers.mts`       | 10 — header keys merge case-sensitively           |
| `f11-conditions.mts`    | 11 — `conditions.pageType` describes another page |
