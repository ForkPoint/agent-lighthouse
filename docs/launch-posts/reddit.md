# Reddit Drafts

Do not cross-post the same text everywhere. Adapt the post to each community and disclose affiliation.

## r/webdev

```text
I built an open-source checker for whether websites are usable by AI agents

Most web tooling checks browser UX, SEO, or performance. I wanted a concrete way to test the newer agent-facing layer: llms.txt, robots rules for GPTBot/ClaudeBot/PerplexityBot, Schema.org, OpenAPI/WebMCP discovery, semantic HTML, accessible controls, and content structure for answer engines.

The tool is called Agent Lighthouse:
npx @forkpoint/agent-lighthouse https://example.com --view

It outputs terminal, HTML, JSON, and Markdown reports. I am affiliated with the project. Feedback on noisy or missing checks would be useful.
```

## r/SEO

```text
Open-source AEO/GEO audit checklist + CLI

I made an open-source scanner for AI-agent and answer-engine readiness. It checks classic machine-readable signals such as Schema.org and robots.txt, but also newer AI-facing files and action surfaces: llms.txt, OpenAPI, WebMCP, MCP discovery, semantic content structure, and citation-friendly pages.

CLI:
npx @forkpoint/agent-lighthouse https://example.com --view

I am affiliated with the project. Curious which checks SEOs would consider actionable vs noisy.
```
