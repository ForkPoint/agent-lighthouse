---
"@forkpoint/agent-lighthouse-core": major
"@forkpoint/agent-lighthouse": major
"@forkpoint/agent-lighthouse-mcp": major
"@forkpoint/agent-lighthouse-report": major
---

Align manual page declarations across SDK, CLI config, and MCP for the v7 applicability contract. Reject invalid declarations before fetching, including malformed override URLs that older SDK versions silently skipped.

Expose page classification, failed fetches, selected-page coverage, and separate advisory populations in HTML, Markdown, terminal diagnostics, MCP summaries, and the shared report view. Preserve old saved reports without inferring absent evidence. Keep audit counts and scores based on one primary result per audit.
