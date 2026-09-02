# Proofs for `../pre-4.0.0-review.md`

Every finding in the review is fixed, and every proof script is gone. Each
script reproduced its defect against the real source in `packages/core/src`
and ended with a `CONFIRMED:` line; the review records what each one printed.
A closed finding's proof is deleted once the fix has its own test, and each
finding's entry in the review names that test.

The directory stays so the review's `proofs/` references resolve, and so the
next review has a place to put its scripts. Convention: one script per open
finding, `node --import tsx docs/architecture/proofs/<name>.mts`, offline
unless the entry says otherwise.
