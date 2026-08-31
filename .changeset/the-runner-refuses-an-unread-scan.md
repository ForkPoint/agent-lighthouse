---
"@forkpoint/agent-lighthouse-core": major
---

A scan that could not read the site now runs no audit at all.

The rule already held, by three separate mechanisms: 211 of 215 audits declared
the evidence they needed and were skipped, four declared none and hand-rolled
the check, and 42 carried a copy of it inside `audit()`. None of that was
in the audit's own code, and 142 of 215 audits had no test that would catch a
missing declaration.

`planAudits` now applies the check once, above every audit's own `requires`, and
`unreachable-contract.test.ts` holds the whole registry to it with no exemption
list. The 42 copies are gone.

What changes for a `runScan` caller: on an unreachable origin, the four audits
that previously produced their own `na` explanation now carry the runner's,
which names the reason the scan gave — `Not assessed: The homepage could not be
fetched: ENOTFOUND.` Every other verdict a scan reports is unchanged, on every
site.

What changes for an SDK caller of `planAudits` / `runAudits`: the `requires`
gate is now on by default. `PlanOptions.enforceEvidence` previously defaulted to
`false`, so `planAudits(ctx, config)` and `runAudits(ctx, config)` with no option
bag ran every audit blind. They now skip an audit whose required evidence the
scan never obtained, reporting `na` tagged `skipped:no-evidence` where a live
verdict used to appear. Pass `{ enforceEvidence: false }` to keep the old
behaviour.

`runScan`'s `enforceEvidenceGate` option is unchanged: it stays documented and
functional as the explicit diagnostic opt-out, and it already defaulted to
`true`. Nothing bypasses the new unread-scan precondition — it takes no option,
and the only full bypass of every gate is a test-only helper that is not
exported from the package.
