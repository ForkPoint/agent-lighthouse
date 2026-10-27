---
"@forkpoint/agent-lighthouse-core": patch
---

`answer-readiness/author-page` no longer fails an author link whose probe got no HTTP response. A request the scheduler held back after the site paused the scan, a timeout or a transport failure now returns not applicable, naming the author link and the cause. An author link that answers with any HTTP status, a 404 included, is still judged.

The shared author-URL probe now keeps the error text of a fetch that throws. `answer-readiness/author-page` and `answer-readiness/about-credentials` name that failure as the cause, instead of a URL safety refusal.
