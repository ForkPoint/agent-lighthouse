---
"@forkpoint/agent-lighthouse-core": patch
---

The per-bot robots.txt checks, such as `access-crawl-control/gptbot` and `google-extended`, now pass a bot allowed through `User-agent: *` instead of warning, and say which group applied. A missing or unreadable robots.txt is not applicable, and the fix text now warns that a named `Allow: /` group drops the catch-all rules.
