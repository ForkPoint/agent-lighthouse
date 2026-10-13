---
"@forkpoint/agent-lighthouse-core": minor
"@forkpoint/agent-lighthouse-report": minor
"@forkpoint/agent-lighthouse": minor
"@forkpoint/agent-lighthouse-mcp": minor
---

Add optional versioned browser-rendered HTML snapshot input and a separate, unscored browser assessment. Reuse the existing parser and audit runner for six individually reviewed DOM checks. Keep crawler findings, scoring, coverage, HTTP evidence gates, and URL-only behavior unchanged.

Export browser-safe snapshot contracts and validation schemas. Preserve snapshot provenance, capture conditions, coverage, and missing-evidence reasons through JSON, hydration, shared views, HTML, Markdown, terminal output, CLI config, and MCP. Bound and validate untrusted input without executing or fetching snapshot resources. The bump is minor: the report gains an optional field and the scan gains an optional input; no existing id, tier, grade, weight or field changes.
