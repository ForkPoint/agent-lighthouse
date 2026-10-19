---
"@forkpoint/agent-lighthouse-core": minor
"@forkpoint/agent-lighthouse-report": minor
"@forkpoint/agent-lighthouse-mcp": minor
"@forkpoint/agent-lighthouse": minor
---

New informative audit `agent-interfaces/mcp-tool-annotation-coverage` (grade A, informative, weight 0). It costs no score. It reads the tools a declared MCP server already returned from `tools/list` and reports their behaviour hints. It fails when a tool carries neither a boolean `readOnlyHint` nor a boolean `destructiveHint`: hosts treat a tool with no hints as possibly destructive and ask before every call, including calls to tools that only read, and the Claude and ChatGPT directory reviews require a hint on servers submitted to them. It warns when a tool lacks any of `readOnlyHint`, `destructiveHint` and `openWorldHint`, which OpenAI requires as explicit booleans on every tool of a plugin in the ChatGPT Directory. It stays informative because those requirements cover only submitted servers, which the audit cannot detect, and an endpoint found through UCP is often a commerce platform's server the site cannot change. A site with no MCP server, a sign-in wall on `tools/list`, or no tools is not applicable. The audit adds no request: it reuses the shared `tools/list` read. The registry grows from 220 to 221 audits.
