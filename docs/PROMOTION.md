# Promotion Kit

Agent Lighthouse should be promoted as one concrete developer outcome:

> Lighthouse, but for AI agents.

Run this, get a report:

```bash
npx @forkpoint/agent-lighthouse https://yourstore.com --view
```

## Links

- GitHub: https://github.com/ForkPoint/agent-lighthouse
- Docs: https://forkpoint.github.io/agent-lighthouse/
- npm CLI: https://www.npmjs.com/package/@forkpoint/agent-lighthouse
- npm MCP server: https://www.npmjs.com/package/@forkpoint/agent-lighthouse-mcp

## One-Liner

Agent Lighthouse audits whether ChatGPT, Claude, Perplexity, MCP clients, AI crawlers, and agentic browsers can discover, parse, cite, and act on your website.

## Short Description

Agent Lighthouse is an open-source CLI, SDK, GitHub Action, and MCP server that runs 207 checks for AI-agent readiness: `llms.txt`, robots.txt crawler access, Schema.org, OpenAPI, WebMCP, AEO/GEO content structure, semantic HTML, accessibility, and technical readiness.

## Launch Checklist

- Use the command demo as the first visual: `npx @forkpoint/agent-lighthouse https://example.com --view`.
- Show one generated HTML report screenshot.
- Show one failing site before/after score.
- Link to docs and npm, not only GitHub.
- Ask users to share public site scores through the issue template.
- Reply quickly to every launch comment with technical details, not marketing language.

## Asset Library

- Terminal demo transcript: [`docs/assets/terminal-demo.txt`](assets/terminal-demo.txt)
- Docs homepage screenshot: [`docs/assets/docs-home-screenshot.png`](assets/docs-home-screenshot.png)
- Generated report screenshot: [`docs/assets/report-screenshot.png`](assets/report-screenshot.png)
- Badge generator screenshot: [`docs/assets/badge-generator-screenshot.png`](assets/badge-generator-screenshot.png)
- Generated report preview: [`docs/assets/report-preview.svg`](assets/report-preview.svg)
- MCP setup visual: [`docs/assets/mcp-setup.svg`](assets/mcp-setup.svg)
- GitHub Pages social preview: [`packages/website/og-image.svg`](../packages/website/og-image.svg)
- Docs page: https://forkpoint.github.io/agent-lighthouse/
- npm package: https://www.npmjs.com/package/@forkpoint/agent-lighthouse

## Ready Drafts

- Hacker News: [`docs/launch-posts/hacker-news.md`](launch-posts/hacker-news.md)
- Product Hunt: [`docs/launch-posts/product-hunt.md`](launch-posts/product-hunt.md)
- Reddit/community: [`docs/launch-posts/reddit.md`](launch-posts/reddit.md)
- Dev.to tutorial: [`docs/launch-posts/devto.md`](launch-posts/devto.md)
- Outreach templates: [`docs/outreach/`](outreach/)
- Awesome list snippets: [`docs/AWESOME_LIST_SUBMISSIONS.md`](AWESOME_LIST_SUBMISSIONS.md)
- GitHub Action setup: [`docs/ACTION_MARKETPLACE.md`](ACTION_MARKETPLACE.md)
- Badge generator notes: [`docs/BADGE.md`](BADGE.md)
- Benchmark story: [`docs/BENCHMARK.md`](BENCHMARK.md)

## Show HN Draft

Title:

```text
Show HN: Agent Lighthouse - audit websites for AI-agent readiness
```

Comment:

```text
Hi HN, we built Agent Lighthouse: a Lighthouse-style CLI for checking whether AI agents and LLM crawlers can understand and act on a website.

It runs 207 checks across llms.txt, robots.txt policies for GPTBot/ClaudeBot/PerplexityBot, Schema.org, OpenAPI, WebMCP, AEO/GEO structure, semantic HTML, accessibility, and technical readiness.

Try it with:

npx @forkpoint/agent-lighthouse https://yourstore.com --view

It outputs terminal, HTML, JSON, and Markdown reports, so it can run locally or in CI. There is also an MCP server for Claude/Cursor-style workflows.

We are looking for feedback on which agent-readiness checks are useful, noisy, or missing.
```

## Product Hunt Draft

Name:

```text
Agent Lighthouse
```

Tagline:

```text
Lighthouse-style audits for AI-agent readiness
```

Description:

```text
Run 207 checks to see whether AI agents, LLM crawlers, MCP clients, and agentic browsers can discover, parse, cite, and act on your website. Includes CLI, SDK, GitHub Action, MCP server, and standalone HTML reports.
```

Maker comment:

```text
Agent Lighthouse helps developers catch the parts of a website that block AI agents: missing llms.txt, blocked AI crawlers, weak Schema.org data, missing OpenAPI/WebMCP discovery, poor semantic HTML, inaccessible controls, and content that is hard for answer/generative engines to cite.

Try:
npx @forkpoint/agent-lighthouse https://yourstore.com --view

We would especially value feedback from SEO, ecommerce, DevRel, and platform teams.
```

## Social Posts

Short:

```text
Launched Agent Lighthouse: Lighthouse, but for AI agents.

It audits whether ChatGPT, Claude, Perplexity, MCP clients, and AI crawlers can discover, parse, cite, and act on your site.

npx @forkpoint/agent-lighthouse https://yourstore.com --view

https://github.com/ForkPoint/agent-lighthouse
```

Developer angle:

```text
Most sites are built for browsers and Googlebot. Agent Lighthouse checks the layer now needed for AI agents: llms.txt, robots rules for AI crawlers, Schema.org, OpenAPI, WebMCP, semantic HTML, accessibility, and AEO/GEO content structure.

CLI + SDK + GitHub Action + MCP server:
https://github.com/ForkPoint/agent-lighthouse
```

Benchmark angle:

```text
We are benchmarking how agent-ready public websites are across 207 checks: llms.txt, AI crawler access, Schema.org, OpenAPI/WebMCP, semantic HTML, accessibility, and technical readiness.

Tool is open source:
https://github.com/ForkPoint/agent-lighthouse
```

## Community Posting

Use value-first posts. Lead with a checklist, benchmark, or teardown. Mention the project after the useful content.

Good targets:

- Hacker News Show HN
- Product Hunt
- Dev.to / Hashnode tutorial
- r/webdev
- r/node
- r/SEO
- r/ecommerce
- MCP and AI-agent tooling communities
- Awesome lists for MCP, llms.txt, SEO, web tooling, and developer tools

Avoid:

- Posting the same link everywhere on the same day
- Asking for upvotes
- Hiding affiliation
- Calling it "AI SEO" without concrete checks

## Tutorial Ideas

- "How to make your website readable by AI agents"
- "What llms.txt, robots.txt, Schema.org, OpenAPI, and WebMCP do for AI agents"
- "Adding an AI-agent readiness gate to GitHub Actions"
- "Before/after: raising an ecommerce site's agent-readiness score"
- "Using an MCP server to audit a staging site from Claude or Cursor"

## Outreach Targets

- SEO agencies serving ecommerce and SaaS sites
- DevRel teams building AI-facing APIs
- Headless commerce platforms
- CMS and site-builder ecosystems
- Accessibility and semantic HTML communities
- MCP server directories and newsletters
- Open-source dev-tool newsletters

## Proof Assets To Capture

- Terminal run screenshot
- HTML report screenshot
- GitHub Actions PR comment screenshot
- Claude/Cursor MCP scan screenshot
- Before/after score improvement
- 100-site benchmark chart
