---
"@forkpoint/agent-lighthouse-core": minor
"@forkpoint/agent-lighthouse-report": minor
"@forkpoint/agent-lighthouse": patch
"@forkpoint/agent-lighthouse-mcp": patch
---

Sunset 18 audits with no proven consumer ("not a factor"). They still run but
are now informative: weight 0, excluded from category scores, the overall
score, recommendations, and top lists, and each result carries a deprecation
notice linking to the public evidence in docs/evidence/NOT-A-FACTOR.md. They
will be removed in the next major.

Additive API: `AuditMeta.deprecated` / `CheckResult.deprecated`
(`DeprecationNotice { notice, link }`), and `migration-map.json` shipped in
the package mapping each sunset v1 audit id to its status and rationale.

Deprecated audit ids: 1.21, 3.10, 3.16, 4.12, 4.14, 4.17, 5.4, 5.11, 5.17,
5.25, 6.12, 6.16, 7.1, 8.5, 8.6, 8.17, 8.21, 10.12.

**Expect scores to move for the same site.** Two movements ship with this
minor, both intended consequences of the sunset:

- `readinessVitals` and the derived `readinessScore` can come out lower than
  before. Informative checks are now excluded from the vitals, and audit 8.21
  (framework-detection) — one of the sunset set — used to feed a constant pass
  into the technical vital, propping it up regardless of the site. Removing
  unearned signal is the point; the new number reflects only checks with
  proven consumers.
- The exported `calculateCategoryScore` now excludes informative checks from
  its mean, so its return value changes for any input containing them
  (previously they counted like any other check). Callers constructing
  `CheckResult` objects directly should expect a different result for the same
  array.
