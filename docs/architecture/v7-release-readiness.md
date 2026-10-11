# 7.0.0 local release readiness

Status: **local validation complete** on `feat/v7-unified-audit-applicability`.
This is not a merge, CI, versioning, or npm publication receipt. Package manifests
remain at 6.0.0. The release workflow owns versioning.

The [machine-readable receipt](./v7-release-readiness.json) records source
fingerprints, gate results, live coverage, consumer checks, and the Changesets
release plan. The [migration plan](./v7-unified-audit-applicability-plan.md)
records the full implementation. The [public migration notes](../scoring.md#migration-from-6x)
explain how callers move from 6.x.

## Saved-response comparison

The baseline is the 6.0.0 release commit
`8fb4bf8dc01a113842dc491609f02ba4e30c8904`, before P1's common-page corrections.
The candidate is the current source tree, identified by its fingerprint in the
receipt. Both runners read the same 41 stored responses, with their original
headers, bodies, response status, and timings. Every fixture's body checksum
matches its provenance file.

The comparison covers 89 scenarios: 41 detected, 41 declarations using the old
purpose value, and 7 explicit migrations from `content` to `article`. The last
set tests a caller's migration; it does not turn a detector's guess into a real
operator declaration.

Each engine produces 19,135 records: 215 audits per scenario. Of these, 12,187
records are unchanged. The remaining 6,948 records have these reviewed causes:

| Cause                | Changed records | Meaning                                                                                                                                                                         |
| -------------------- | --------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Common-page gate     |           6,441 | The old runner withheld common checks when the sample had no readable homepage. V7 lets them use an eligible interior page. Some still return NA under their own preconditions. |
| Article population   |             468 | The 12 article obligations no longer apply to general/unknown pages or legacy `content` declarations. On some shells, a type skip replaces an evidence skip.                    |
| Detected, gated mode |              39 | A detected typed population now keeps informative mode even when evidence prevents execution. Both results remain NA and contribute no score.                                   |

There are 3,577 status changes. The other 3,371 changed records retain NA while
changing the gate reason, tags, or display mode. No record changes from an
assessed pass to an assessed fail. There are no audit errors or unexplained
transitions in this replay.

The [comparison JSON](./v7-corpus-comparison.json) retains every changed audit,
exact before/after state, cause, and affected scenario. It groups shared coverage
sets to avoid repeating URL lists. Its `readingGuide` explains the indexes. Old
coverage stays **not recorded**; the report does not invent old URL sets.

The review script accepts only the three explicit transition patterns above.
A negative control that inserted an unrelated pass-to-fail change failed with
exit 1 and `unknown: 1`.

### What this comparison does not prove

This is a runner/evidence replay, not a full crawl. Secondary requests receive
synthetic 404s, root files are absent, and accessibility-engine results are not
supplied. Those outcomes describe the harness, not missing features on the real
sites. DNS is stubbed and direct HTTP is disabled. `runnerScore` is the runner's
raw average before the orchestrator suppresses unscorable scans; it is not a
public site score.

Each scenario has one page. Existing integration tests provide the mixed-page,
failed-override, page-order, shared-cache, and concurrent-scan proof. The corpus
comparison supplements those tests. It does not replace them.

### Reproduce the comparison

From the repository root with dependencies installed:

```sh
baseline_dir="$(mktemp -d /tmp/al-v7-baseline.XXXXXX)"
repo_dir="$PWD"
git archive 8fb4bf8dc01a113842dc491609f02ba4e30c8904 | tar -x -C "$baseline_dir"
ln -s "$repo_dir/node_modules" "$baseline_dir/node_modules"
for package in core cli report mcp; do
  ln -s "$repo_dir/packages/$package/node_modules" "$baseline_dir/packages/$package/node_modules"
done
node --import tsx scripts/compare-v7-corpus.mjs \
  --baseline-root="$baseline_dir" --out=/tmp/v7-corpus-raw.json
node scripts/review-v7-corpus.mjs \
  /tmp/v7-corpus-raw.json /tmp/v7-corpus-review.json
```

The baseline and candidate share the installed dependency set. The lockfile did
not change during this migration. The script fixes `Date.now()` to the comparison
date recorded in its output. Neither script rewrites the saved corpus or its
snapshots.

## Package and live proof

- Isolated distribution tests compile and run ESM and CommonJS consumers without
  workspace source files. They exercise the new page schemas, manual controls,
  coverage types, report formatters, and MCP helper. An old `content` page still
  parses without new classification fields.
- The built MCP stdio server handles initialization and `tools/list`. It advertises
  `article`, `unknown`, and extra-page declarations. An invalid `author` purpose
  fails before a scan. The built CLI rejects the same invalid purpose.
- Three full live scans completed: `allbirds.com`, `developer.mozilla.org`, and
  `example.com`. No robots skips and no report-invariant violations occurred.
  The first two supplied readable text. `example.com` lacked enough body evidence
  and correctly returned an unscored result. These checks prove report consistency,
  not the correctness of every finding on a live site.
- The P5 browser checks already prove the built HTML scope panels and website
  JSON inspector. P6 makes no product-code changes that invalidate that proof.

## Final gates

All seven ran in order and exited 0:

```sh
pnpm build
pnpm test
pnpm typecheck
pnpm lint
pnpm check:dossiers
pnpm check:requires
pnpm check:audit-map
```

The full test run passed **5,937 tests across 350 files**. It skipped **219 tests
and 1 file**. Network verification remained enabled. Dossier and requirement
checks cover 215 audits. The audit map agrees with 215 active audits and 207
legacy mappings.

Changesets' read-only plan selects a **7.0.0 major** for all four published
packages. It also selects the private website's dependent patch. The existing
release-versioning test passes. No package version was edited by hand.

## Remaining release actions

Review and commit the local candidate, obtain CI results for that exact commit,
merge through the normal workflow, then review its versioning PR and publication
receipt. These actions need their own instruction. Existing P2 ledger deferrals
remain recorded; this migration does not claim to resolve every possible audit
quality improvement.
