---
"@forkpoint/agent-lighthouse-core": patch
---

`access-crawl-control/canonical` no longer warns when a page declares no canonical URL, because Google documents that a canonical is not required and picks one itself. A site where no scanned page declares one is now not applicable; a site where only some pages do is judged on the declared canonicals, and the pages without one are named in the pass message. Invalid canonicals and canonicals that collapse onto the homepage still fail.
