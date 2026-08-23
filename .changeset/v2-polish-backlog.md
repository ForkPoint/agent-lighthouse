---
"@forkpoint/agent-lighthouse-core": major
"@forkpoint/agent-lighthouse-report": patch
"@forkpoint/agent-lighthouse": patch
"@forkpoint/agent-lighthouse-mcp": patch
---

v2 polish wave: engine fixes, tier surfacing, two live CLI flags.

**Scoring change.** A category where every check is notApplicable now leaves the
overall denominator. A site with no commerce surface is no longer scored down
for having no checkout, so narrow sites score higher than they did on the same
registry. That is the intended correction.

**Security fix.** `isSafeUrl` now gates every hop of a redirect chain, not just
the URL the caller passed — a site could previously redirect the scanner into
link-local or RFC 1918 space. `FetchResult.finalUrl` is now the URL that
actually answered.

**Fixed:** `AuditResult.details` no longer silently drops unknown keys, so an
audit's structured evidence reaches the report; `fail()` and `warn()` no longer
discard a per-result fix snippet in favour of the generic one.

**New:** advisory and experimental checks are badged in the HTML report, marked
in terminal output, counted in the markdown summary and filterable in the audit
explorer, so a weight-0 check no longer reads as a defect. `--categories <list>`
finally filters the registry and rejects unknown ids; `--experimental` opts in
to experimental-tier audits, which are excluded by default.

Also: nine audit-behavior defects, five strengthened tests, and the website
audit explorer regenerated from the live 172-audit registry.
