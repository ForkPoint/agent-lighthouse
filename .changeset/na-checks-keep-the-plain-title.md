---
"@forkpoint/agent-lighthouse-core": patch
---

A not-applicable check now carries the audit's plain title instead of its
failure title.

`failureTitle` names what went wrong, and `toCheckResult` was giving it to every
non-passing status — including `na`. A not-applicable check did not go wrong:
its precondition was absent. The result was a report row that read
"Meta-ExternalAgent disallowed by robots.txt" over a site that serves no
robots.txt at all, or "The markdown alternate this site serves is not usable"
over a site that serves none.

Reports and the JSON output carry the corrected titles. No score changes: `na`
was already excluded from scoring.
