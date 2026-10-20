---
"@forkpoint/agent-lighthouse-core": patch
---

`access-crawl-control/robots-directives` now scores only the robots meta names a crawler operator documents reading: `robots`, `googlebot`, `googlebot-news`, `bingbot` and `applebot` (verified 2026-10-20). A `noindex` or `nosnippet` addressed to `gptbot`, `oai-searchbot`, `chatgpt-user`, `claudebot`, `claude-searchbot`, `claude-user`, `perplexitybot`, `ccbot`, `google-extended`, `applebot-extended` or `msnbot`, in a meta tag or a bot-scoped `X-Robots-Tag`, no longer fails or warns. The pass message names such tags as not scored. Sites that addressed a directive only to one of those names may see their score rise.
