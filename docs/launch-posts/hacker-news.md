# Hacker News Draft

Title:

```text
Show HN: Agent Lighthouse - audit websites for AI-agent readiness
```

Comment:

```text
Hi HN, we built Agent Lighthouse: a Lighthouse-style CLI for checking whether AI agents and LLM crawlers can understand and act on a website.

It runs 215 checks across llms.txt, robots.txt policies for GPTBot/ClaudeBot/PerplexityBot, Schema.org, OpenAPI, WebMCP, AEO/GEO structure, semantic HTML, accessibility, and technical readiness.

Try it:

npx @forkpoint/agent-lighthouse https://yourstore.com --view

It outputs terminal, HTML, JSON, and Markdown reports, so it can run locally or in CI. There is also an MCP server for Claude/Cursor-style workflows.

We are especially looking for feedback on which agent-readiness checks are useful, noisy, or missing.
```
