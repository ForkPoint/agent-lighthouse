---
"@forkpoint/agent-lighthouse-core": major
---

A scan that could not read the site now runs no audit at all.

The rule previously depended on separate mechanisms. The `requires` gate
skipped 211 of 215 audits. The other four declared no requirements and checked
the unread state inside `audit()`. In total, 42 audit files carried a local copy
of that check, while 142 of 215 audits had no test that would catch a missing
declaration.

`planAudits` now applies the check once, above every audit's own `requires`, and
`unreachable-contract.test.ts` holds the whole registry to it with no exemption
list. The 42 copies are gone.

What changes for a `runScan` caller: every audit on an unread scan now carries
the runner's `na` stub. This replaces more than the four local `na`
explanations. It also suppresses direct-audit WAF failures, cross-origin
redirect failures, and plain-HTTP failures because none may verdict when the
scan read no attributable site response. These changes affect the findings and
any score derived from them. Each stub names the scan reason, for example
`Not assessed: The homepage could not be fetched: ENOTFOUND.`

What changes for an SDK caller: the `requires` gate in `planAudits` is now on by
default. `PlanOptions.enforceEvidence` previously defaulted to `false`, so
`planAudits(ctx, config)` ran audits without checking their declared evidence.
Pass `{ enforceEvidence: false }` as the third argument to bypass only those
`requires` checks. `runAudits` has no `PlanOptions` argument. A caller that needs
that diagnostic mode first builds a plan with `planAudits`, then passes the
precomputed plan as the fourth `runAudits` argument. Without a plan, `runAudits`
uses the default gated plan.

`runScan`'s `enforceEvidenceGate` option stays available as the explicit
diagnostic opt-out for `requires`, and it already defaulted to `true`. Passing
`false` never bypasses the unread-scan precondition. The only full bypass of
every gate is a test-only helper that is not exported from the package.
