---
"@forkpoint/agent-lighthouse-core": patch
---

`access-crawl-control/ai-bot-directives` now passes when YouBot and AI2Bot are allowed through `User-agent: *` or by no applicable rule, instead of warning; a block still fails. A missing or unreadable robots.txt is not applicable, and the check is retitled "Documented AI bots allowed by robots.txt".
