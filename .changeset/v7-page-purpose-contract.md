---
"@forkpoint/agent-lighthouse-core": major
"@forkpoint/agent-lighthouse": major
"@forkpoint/agent-lighthouse-report": major
"@forkpoint/agent-lighthouse-mcp": major
---

Separate article purpose from general pages. Add `article` and `unknown` page types,
classification source, signal strength, and signal names. Keep `content` accepted
as a legacy general-page declaration and normalize it to `unknown`; use `article`
to explicitly select article obligations. Detected typed findings remain informative.

Make page identity independent of crawl order. Restrict 12 article obligations to
article-purpose pages and preserve the previous general-page population for 10
other typed checks. Normalize custom audit metadata to `applicablePageTypes` at
the runner boundary; accept equivalent `pageTypes` aliases and reject conflicts,
including conflicts involving empty arrays. Older report conditions remain readable.

This starts the 7.0.0 contract migration. Mixed-provenance execution, selected-page
evidence, and the full coverage/report contract remain separate planned work.
