---
"@forkpoint/agent-lighthouse-core": patch
---

`https-enabled` no longer says that GPTBot, ClaudeBot and other AI crawlers skip plain-HTTP sites. No crawler vendor documents that. The message now names what is documented: agent protocols such as MCP require HTTPS, and browser-based agents warn on or block plain-HTTP pages. The verdict is unchanged.
