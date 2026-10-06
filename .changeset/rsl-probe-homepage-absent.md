---
"@forkpoint/agent-lighthouse-core": patch
---

Stop failing `access-crawl-control/rsl-licensing-terms-conformance` when `/license.xml` or `/rsl.xml` redirects to the homepage. A guessed path whose body is not an RSL document now counts as no licence, and the audit returns not applicable.
