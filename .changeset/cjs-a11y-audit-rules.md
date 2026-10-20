---
"@forkpoint/agent-lighthouse-core": patch
"@forkpoint/agent-lighthouse": patch
"@forkpoint/agent-lighthouse-mcp": patch
---

Accessibility audits returned another audit's result when run from the CLI or MCP server; scores in operability-safety change.

Fix the accessibility audits in core's CommonJS build. Up to 9.1.0, every audit built on the shared accessibility rule engine evaluated the rule of `operability-safety/presentation-conflict` instead of its own. That affected 16 audits, among them `label`, `accessible-names`, `aria-roles`, `aria-attributes`, `document-title` and `frame-title`. The CommonJS build is the one the `agent-lighthouse` CLI, the `agent-lighthouse-mcp` server and any `require()` of the packages load. In those, each of the 16 audits reported the verdict of the presentation-role check, and its `expected` text named that rule. The ESM build (`import`) was correct. Audit ids, tiers, grades and weights are unchanged. Sites scanned through the CLI or the MCP server may see these audits, and their operability-safety score, change to what their own rules find.
