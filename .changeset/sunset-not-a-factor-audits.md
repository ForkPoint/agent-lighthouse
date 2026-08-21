---
"@forkpoint/agent-lighthouse-core": major
"@forkpoint/agent-lighthouse-report": minor
"@forkpoint/agent-lighthouse": patch
"@forkpoint/agent-lighthouse-mcp": patch
---

**Removed 18 audits with no proven consumer ("not a factor").** They no longer
run, no longer appear in any report, and no longer emit a `CheckResult` under
their old id. An adversarial evidence review — one researcher per audit, tasked
with *redeeming* it by naming a consumer with grade A/B evidence — could not
find one for any of these: either nothing reads the signal, or the only thing
that ever did publicly stopped (OpenAI archived the ai-plugin.json spec; Google
states it no longer uses rel=prev/next). Shipping them as informative would
have kept noise on the report with a badge attached, so they are deleted.

Removed audit ids: 1.21, 3.10, 3.16, 4.12, 4.14, 4.17, 5.4, 5.11, 5.17, 5.25,
6.12, 6.16, 7.1, 8.5, 8.6, 8.17, 8.21, 10.12.

**Expect scores to move for the same site.** Every category score, the overall
score, and `readinessVitals` / the derived `readinessScore` can come out
different — the removed checks are gone from the denominators. Audit 8.21
(framework-detection) in particular used to feed a near-constant pass into the
technical vital, propping it up regardless of the site; that unearned signal is
gone, so the new number can be lower and is the honest one.

**Consumers keying on these check ids must migrate via `migration-map.json`,**
shipped in the core package and keyed by v1 audit id. Each entry carries
`slug`, `status: "removed"`, `reason: "not-a-factor"`, and a `link` to that
audit's rationale anchor. Look every missing id up there before treating its
absence as a scan failure; a `"removed"` id has no replacement to re-point a
dashboard at. See `MIGRATION.md`.

Full rationale — steelmanned claim, why it is not a factor, verdict and sources
per audit, plus the complete research dossiers — lives in
`docs/evidence/sunset/NOT-A-FACTOR.md`.

Also in this release: the exported `calculateCategoryScore` now excludes
informative checks from its mean, so its return value changes for any input
containing them (previously they counted like any other check). Callers
constructing `CheckResult` objects directly should expect a different result
for the same array. The deprecation machinery — `AuditMeta.deprecated` /
`CheckResult.deprecated` (`DeprecationNotice { notice, link }`), the
`isInformative` predicate, and the report's deprecation-notice rendering — is
kept for future deprecations and the planned informative tier.
