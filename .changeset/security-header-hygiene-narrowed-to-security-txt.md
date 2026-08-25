---
"@forkpoint/agent-lighthouse-core": major
---

`operability-safety/security-header-hygiene` is narrowed to the one signal its
evidence supports: `/.well-known/security.txt`. The Strict-Transport-Security,
Content-Security-Policy and X-Content-Type-Options rows are gone from the report,
and the audit no longer reads response headers at all.

The audit's own research grades those three headers **D**, with
`Consumers: none-known` and `Recommended tier: delete`. The two other headers in
that same researched signal — Referrer-Policy and Permissions-Policy — were
already removed outright in v2 for exactly that reason, so keeping three of the
five was an inconsistency. The grade the audit shipped, **B**, belonged to the
HTTPS/TLS signal, which this audit never measured and which already ships scored
as `access-crawl-control/https-enabled`.

What survives is the security.txt check, at the grade its own research records:
**C**, informative, weight 0. Its detection is unchanged — the well-known
location with a legacy top-level fallback, a soft-404 guard, and RFC 9116
`Contact` plus an unexpired `Expires`.

The pass rule narrows with it. A site that publishes no security.txt is now
reported as **not applicable** rather than warned: RFC 9116 is an Informational
document, publishing the file is optional, and adoption is about 1.25% of the
top 1M domains. Only a published file that fails RFC 9116 warns, at priority
`low`. A valid file passes. The audit still never returns `fail`.

No score moves. The audit was weight 0 before and is weight 0 after, so every
category score and the overall score are unchanged, and the scored set is the
same size. What changes is the report. Most sites lose a warning they could not
usefully act on; sites that were warned only for missing security headers now
pass; and the check's title, description and remediation now describe
security.txt instead of a header checklist.

The check id `operability-safety/security-header-hygiene` is unchanged in this
release, so nothing keyed on it breaks — but the name no longer describes what
the check measures, and a rename to `operability-safety/security-txt` is
expected in a later release.
