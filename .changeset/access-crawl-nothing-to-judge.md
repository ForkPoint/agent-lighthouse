---
"@forkpoint/agent-lighthouse-core": patch
---

Three access and crawl-control audits no longer judge what is not there. `crawl-delay` is not applicable when the site serves no robots.txt or sets no `Crawl-delay`; it used to warn on the first and pass the second. `no-redirect-chains` is not applicable when no page was scanned; it used to fail. `no-bot-detection` is not applicable when no page was scanned and no bot wall was detected; it used to warn. Every verdict on a robots.txt, page or wall that the scan did read is unchanged.
