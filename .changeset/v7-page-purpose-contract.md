---
"@forkpoint/agent-lighthouse-core": major
"@forkpoint/agent-lighthouse": major
"@forkpoint/agent-lighthouse-report": major
"@forkpoint/agent-lighthouse-mcp": major
---

Separate article purpose from general pages. The page types are now `homepage`,
`category`, `product`, `article` and `general`. `article` is an editorial page with
author and date obligations. `general` is any other page, such as about, FAQ, help,
contact or policy pages, and it is also what the classifier returns when it cannot
tell, with confidence `unknown`. The `content` and `unknown` page types are removed:
`--page-type`, config files and the MCP tool refuse them with an error that names
`general`, and saved reports that carry them read back as `general`. Results add
classification source, signal strength and signal names. Detected typed findings
remain informative.

Make page identity independent of crawl order. Restrict 12 article obligations to
article-purpose pages and preserve the previous general-page population for 10
other typed checks. Normalize custom audit metadata to `applicablePageTypes` at
the runner boundary; accept equivalent `pageTypes` aliases and reject conflicts,
including conflicts involving empty arrays. Older report conditions remain readable.

This starts the 7.0.0 contract migration. Mixed-provenance execution, selected-page
evidence, and the full coverage/report contract remain separate planned work.
