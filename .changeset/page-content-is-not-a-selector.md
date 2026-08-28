---
'@forkpoint/agent-lighthouse-core': major
---

`answer-readiness/extractor-survival-recall` reports a verdict on pages whose
structured data contains a bracket, instead of reporting nothing at all.

**What it did.** The audit measures which of a page's key spans survive the
extractors an answer engine uses. One of those spans is a JSON-LD string the
prose repeats, and to name the element it lives in the audit built a CSS
selector out of the string itself: `:contains("<the first 40 characters>")`.
Page content is not a selector. gov.uk publishes the service name "Register
your vehicle as off the road (SORN)", and 40 characters in the closing bracket
is gone, so css-what threw `Parenthesis not matched` before the audit ever
reached a verdict. A throw is not a verdict: the scan runner replaces the
result with a `scan-error` stub, so a page the audit had already measured got
no report at all — no pass, no fail, nothing for the site owner to act on.
Brackets, quotes and backslashes are ordinary things for a site to publish, so
the lookup no longer builds a selector: it walks the DOM in reverse and takes
the last element whose text carries the string, which is what the selector was
asked for.

**Measured.** Over the 41 real-page fixtures in
`packages/core/test-data/corpus/real/`, running all 215 registered audits
against each: one throw before, none after. The single fixture affected *by
this fix* is `gov-uk-vehicle-tax`, whose verdict moves `scan-error` → `fail` —
the audit now says what it found. No other audit changed by this fix moves on
any fixture.

One other cell moves across the same corpus, from a different change in this
release and disclosed in its own changeset: `answer-readiness/unique-meta`
moves **pass → na on 41 of 41 fixtures**, because a one-page scan holds fewer
than two distinct canonical pages and the audit no longer reports `pass` with a
message that reads "uniqueness check not applicable". Whoever regenerates this
snapshot should expect exactly those 42 cells to move against 3.0.0 and nothing
else.

Scores move only for a page in that shape. `scan-error` scored nothing, so a
site publishing bracketed structured data now carries this audit's weight
(grade B, 0.6) in its answer-readiness score for the first time, in whichever
direction the audit's real verdict falls.
