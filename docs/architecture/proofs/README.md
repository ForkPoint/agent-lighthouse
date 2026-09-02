# Proofs for `../pre-4.0.0-review.md`

One script per finding. Each one reproduces the defect against the real source
in `packages/core/src` and prints what it measured. Twelve of the fourteen end
with a `CONFIRMED:` line; `f1c-dupes.mts` and `f2b-realistic.mts` print a
measurement table instead, because what they establish is a number, not a
yes-or-no.

Run one:

```bash
node --import tsx docs/architecture/proofs/f1-cache.mts
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
| `f1-cache.mts`          | 1 — context spread defeats the gatherer cache     |
| `f1b-scope.mts`         | 1 — every runnable audit takes the spread branch  |
| `f1c-dupes.mts`         | 1 — duplicate-fetch measurement                   |
| `f2-pagetype.mts`       | 2 — page-typed audits demoted to informative      |
| `f2b-realistic.mts`     | 2 — weight lost per declared page type            |
| `f3-sitemap-break.mts`  | 3 — only the first declared sitemap is read       |
| `f4-nullish.mts`        | 4 — broken sitemap reported as absent             |
| `f3-originhomepage.mts` | 5 — origin homepage cached as `undefined`         |
| `f5-assessedmass.mts`   | 6 — `assessedMass` never set on the scan path     |
| `f9-samehost.mts`       | 7 — `sameHost` accepts a parent domain            |
| `f7-cachekey.mts`       | 8 — origin cache key ignores headers              |
| `f8-unbounded.mts`      | 9 — origin cache retains expired entries          |
| `f10-headers.mts`       | 10 — header keys merge case-sensitively           |
| `f11-conditions.mts`    | 11 — `conditions.pageType` describes another page |
