# Dev.to / Hashnode Article Draft

# How To Make A Website Readable By AI Agents

AI agents do not browse sites like humans. They need fast discovery, clear permissions, structured facts, and machine-readable action surfaces.

Here is a practical checklist:

1. Add `/llms.txt` with a short summary and links to important pages.
2. Publish a complete sitemap and RSS/Atom feed for crawl discovery.
3. Make robots.txt explicit for AI crawlers such as GPTBot, ClaudeBot, PerplexityBot, and OAI-SearchBot.
4. Add Schema.org JSON-LD for Organization, WebSite, Product, Offer, Review, FAQPage, Article, and SearchAction where relevant.
5. Link OpenAPI specs and WebMCP manifests when agents should take actions.
6. Use semantic HTML landmarks, headings, lists, tables, and accessible button/form names.
7. Keep server-rendered content available without heavy client-side interaction.

You can test the checklist with Agent Lighthouse:

```bash
npx @forkpoint/agent-lighthouse https://example.com --view
```

The report gives terminal, HTML, JSON, and Markdown outputs and can run locally, in CI, or through an MCP server in Claude/Cursor-style workflows.
