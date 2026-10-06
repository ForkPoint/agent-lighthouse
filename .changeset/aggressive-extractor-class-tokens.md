---
"@forkpoint/agent-lighthouse-core": patch
---

`answer-readiness/extractor-survival-recall` now matches its stripper blocklist against whole class tokens and ids, as Firecrawl's selectors do, and never drops an element holding most of the page's text. Script contents no longer count as prose, so JSON-LD URLs are not reported as lost facts.
