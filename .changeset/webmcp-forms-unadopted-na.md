---
"@forkpoint/agent-lighthouse-core": patch
---

`agent-interfaces/webmcp-declarative-forms` is now not applicable when no form carries any declarative WebMCP attribute, instead of failing every site with a form. Present but broken markup still fails or warns.
