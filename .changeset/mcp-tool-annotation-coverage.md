---
"@forkpoint/agent-lighthouse-core": minor
"@forkpoint/agent-lighthouse-report": minor
"@forkpoint/agent-lighthouse-mcp": minor
"@forkpoint/agent-lighthouse": minor
---

New audit `agent-interfaces/mcp-tool-annotation-coverage` (grade A, scored). It reads the tools a declared MCP server already returned from `tools/list` and checks their behaviour hints. It fails when a tool carries neither a boolean `readOnlyHint` nor a boolean `destructiveHint`, because Claude and VS Code decide confirmation prompts from them and both Anthropic's and OpenAI's directory reviews require them. It warns when a tool lacks any of `readOnlyHint`, `destructiveHint` and `openWorldHint`, which OpenAI requires as explicit booleans on every ChatGPT app tool. A site with no MCP server, a sign-in wall on `tools/list`, or no tools is not applicable. The audit adds no request: it reuses the shared `tools/list` read. The registry grows from 220 to 221 audits.
