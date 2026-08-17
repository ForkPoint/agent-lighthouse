# @forkpoint/agent-lighthouse

Lighthouse-style CLI for auditing whether AI agents, LLM crawlers, MCP clients, and agentic browsers can discover, parse, cite, and act on a website.

## Quickstart

```bash
npx @forkpoint/agent-lighthouse https://yourstore.com
npx @forkpoint/agent-lighthouse https://yourstore.com --view
npx @forkpoint/agent-lighthouse https://staging.yourstore.com --min-score 85
```

The CLI generates terminal, HTML, JSON, and Markdown reports for 199 audits across:

- `llms.txt`, `llms-full.txt`, sitemaps, and RSS discovery
- robots.txt access for GPTBot, ClaudeBot, PerplexityBot, and other AI crawlers
- Schema.org, JSON-LD, product, offer, review, and organization markup
- WebMCP, OpenAPI, agents.json, and action-surface discovery
- AEO/GEO content structure, semantic HTML, accessibility, and technical readiness

## CI

```bash
npx @forkpoint/agent-lighthouse https://staging.yourstore.com \
  --preset ecommerce \
  --min-score 85 \
  --output terminal,html,json,md \
  --output-dir ./reports
```

## Links

- Documentation: https://forkpoint.github.io/agent-lighthouse/
- Repository: https://github.com/ForkPoint/agent-lighthouse
- Issues: https://github.com/ForkPoint/agent-lighthouse/issues

## License

GPL-3.0-only
