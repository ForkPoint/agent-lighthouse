---
"@forkpoint/agent-lighthouse-core": patch
---

`operability-safety/wikidata-round-trip-verification` no longer warns a site when Wikidata does not answer. An unreachable entity is listed as unverified and does not decide the verdict. When no claimed entity could be read, the result is not applicable, because nothing about the site was measured.
