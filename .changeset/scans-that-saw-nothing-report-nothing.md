---
'@forkpoint/agent-lighthouse-core': major
'@forkpoint/agent-lighthouse-report': major
'@forkpoint/agent-lighthouse': major
'@forkpoint/agent-lighthouse-mcp': major
---

A scan that saw too little now says so, instead of scoring the site anyway.

**The gate is on.** An audit whose required evidence the scan never obtained is
skipped, reports `na` tagged `skipped:no-evidence` with the reason attached, and
is never constructed. Pass `enforceEvidenceGate: false` to `runScan` to run
every audit regardless.

**The score can be absent.** `ScanReport.overallScore` and `scoreTier` are now
`number | null` and `ScoreTier | null`. They are null when the scan never
reached the site, was refused, or lost so much of the registry's evidence mass
to the gate that what remains is not a reading of the site. The report carries a
new `scanValidity` block saying which evidence classes were obtained, why the
missing ones are missing, and — when suppressed — why there is no score. Every
surface renders that as "Not scored" with the reason, never as `0`.

**Two audits stop lying about being blocked.** `no-blocking-captcha` reported a
pass on a site that walled the scanner: it looked for CAPTCHA markup in pages it
never received. It now fails and names the wall, and returns `notApplicable`
when no page was fetched. A rate limit is excluded — that is the scan asking too
fast, not the site refusing agents.

**A homepage 429 is retried once**, after `Retry-After` when the site sends one,
before the scan concludes it was blocked.

**`na` no longer leaks into `recommendations`.** Core now filters to `fail` and
`warn`, which is what `packages/report` always did.
