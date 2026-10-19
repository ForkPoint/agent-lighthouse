# @forkpoint/agent-lighthouse

Lighthouse-style CLI that audits whether AI agents, LLM crawlers, MCP clients and agentic browsers can discover, parse, cite and act on a website.

## Quickstart

```bash
npx @forkpoint/agent-lighthouse https://example.com
npx @forkpoint/agent-lighthouse https://example.com --view
npx @forkpoint/agent-lighthouse https://staging.example.com --min-score 85
```

It writes terminal, HTML, JSON and Markdown reports for 221 audits in 8 categories:

- Access & Crawl Control — robots.txt access for GPTBot, ClaudeBot, PerplexityBot and other AI crawlers
- Content Extraction — clean main content, semantic structure, render and response cost
- Machine Discovery — `llms.txt`, `llms-full.txt`, sitemaps, feeds and `.well-known` files
- Structured Data — Schema.org, JSON-LD, product, offer, review and organization markup
- Answer Readiness — answerability, step lists, tables, unique data and citations
- Agent Interfaces — WebMCP, OpenAPI, agents.json and action-surface discovery
- Agentic Commerce — product offers, availability, checkout and payment surfaces
- Agent Operability & Safety — HTTPS, security.txt, tdmrep, stability and broken agent endpoints

## CI

```bash
npx @forkpoint/agent-lighthouse https://staging.example.com \
  --min-score 85 --output terminal,html,json,md --output-dir ./reports
```

Run `agent-lighthouse --help` for every flag, or read the [CLI reference](https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/cli.md).

## Links

- Documentation: https://forkpoint.github.io/agent-lighthouse/
- Repository: https://github.com/ForkPoint/agent-lighthouse
- Issues: https://github.com/ForkPoint/agent-lighthouse/issues

## License

Apache-2.0
