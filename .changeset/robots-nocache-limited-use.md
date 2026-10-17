---
"@forkpoint/agent-lighthouse-core": patch
---

`access-crawl-control/robots-directives` no longer warns on `nocache`, because Bing documents that such pages still appear in Copilot answers with their URL, title and snippet; the pass message names them instead. A page carrying both `noarchive` and `nocache` is treated as `nocache`, as Bing documents, while `noarchive` alone, `nosnippet` and `max-snippet:0` still warn.
