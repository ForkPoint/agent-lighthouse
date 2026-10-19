# Media kit

Boilerplate, assets and drafts for writing about Agent Lighthouse.

Positioning line: **Lighthouse, but for AI agents.** The demo is the product:

```bash
npx @forkpoint/agent-lighthouse https://example.com --view
```

## Facts

|                  |                                                                          |
| :--------------- | :----------------------------------------------------------------------- |
| What it is       | Open-source CLI, SDK, GitHub Action and MCP server                       |
| What it does     | Audits whether AI agents can discover, parse, cite and act on a website  |
| Checks           | 220 audits across 8 categories, each backed by a public evidence dossier |
| Outputs          | Terminal, HTML, JSON and Markdown reports                                |
| Licence          | Apache-2.0                                                               |
| Repository       | https://github.com/ForkPoint/agent-lighthouse                            |
| Documentation    | https://forkpoint.github.io/agent-lighthouse/                            |
| npm — CLI        | https://www.npmjs.com/package/@forkpoint/agent-lighthouse                |
| npm — MCP server | https://www.npmjs.com/package/@forkpoint/agent-lighthouse-mcp            |

The audit count comes from the registry. Update `215` here and in the drafts when it changes.

## Boilerplate

**One line**

```text
Agent Lighthouse audits whether ChatGPT, Claude, Perplexity, MCP clients, AI crawlers, and agentic browsers can discover, parse, cite, and act on your website.
```

**One paragraph**

```text
Agent Lighthouse is an open-source CLI, SDK, GitHub Action, and MCP server that runs 215 checks for AI-agent readiness: llms.txt, robots.txt crawler access, Schema.org, OpenAPI, WebMCP, AEO/GEO content structure, agentic commerce, and agent operability.
```

**What makes it different**

```text
Every check carries a public evidence dossier naming the agent or vendor documentation that consumes the signal. A check with no documented consumer is reported but never scored, so a site's score only moves on evidence someone can go and read.
```

## Assets

- Terminal demo transcript — [`docs/assets/terminal-demo.txt`](assets/terminal-demo.txt)
- Docs homepage screenshot — [`docs/assets/docs-home-screenshot.png`](assets/docs-home-screenshot.png)
- Generated report screenshot — [`docs/assets/report-screenshot.png`](assets/report-screenshot.png)
- Badge generator screenshot — [`docs/assets/badge-generator-screenshot.png`](assets/badge-generator-screenshot.png)
- Report preview — [`docs/assets/report-preview.svg`](assets/report-preview.svg)
- MCP setup visual — [`docs/assets/mcp-setup.svg`](assets/mcp-setup.svg)
- Social preview — [`packages/website/public/og-image.svg`](../packages/website/public/og-image.svg)
- Logos and brand rules — [brand guide](../packages/website/public/brand/BRAND.md)

Still worth capturing: a GitHub Actions PR comment, an MCP scan inside Claude or Cursor, and a before/after score.

Related: [badge](badge.md) · [GitHub Action](github-action.md) · [benchmark](benchmark.md) · [scoring](scoring.md)

## Launch drafts

### Show HN

```text
Show HN: Agent Lighthouse - audit websites for AI-agent readiness

Hi HN, we built Agent Lighthouse: a Lighthouse-style CLI for checking whether AI agents and LLM crawlers can understand and act on a website.

It runs 215 checks across llms.txt, robots.txt policies for GPTBot/ClaudeBot/PerplexityBot, Schema.org, OpenAPI, WebMCP, AEO/GEO structure, agentic commerce, and agent operability.

Try it with:

npx @forkpoint/agent-lighthouse https://example.com --view

It outputs terminal, HTML, JSON, and Markdown reports, so it can run locally or in CI. There is also an MCP server for Claude/Cursor-style workflows.

Every check publishes the evidence behind it, including the ones we found no documented consumer for — those are reported and never scored.

We are looking for feedback on which agent-readiness checks are useful, noisy, or missing.
```

### Product Hunt

```text
Name:     Agent Lighthouse
Tagline:  Lighthouse-style audits for AI-agent readiness

Description:
Run 215 checks to see whether AI agents, LLM crawlers, MCP clients, and agentic browsers can discover, parse, cite, and act on your website. Includes CLI, SDK, GitHub Action, MCP server, and standalone HTML reports.

Maker comment:
Agent Lighthouse helps developers catch the parts of a website that block AI agents: blocked AI crawlers, weak Schema.org data, missing OpenAPI/WebMCP discovery, poor semantic HTML, inaccessible controls, and content that is hard for answer engines to cite.

Try: npx @forkpoint/agent-lighthouse https://example.com --view

We would especially value feedback from SEO, ecommerce, DevRel, and platform teams.
```

### Reddit

Adapt per community and disclose affiliation. Do not cross-post one text.

**r/webdev**

```text
I built an open-source checker for whether websites are usable by AI agents

Most web tooling checks browser UX, SEO, or performance. I wanted a concrete way to test the newer agent-facing layer: llms.txt, robots rules for GPTBot/ClaudeBot/PerplexityBot, Schema.org, OpenAPI/WebMCP discovery, semantic HTML, accessible controls, and content structure for answer engines.

npx @forkpoint/agent-lighthouse https://example.com --view

It outputs terminal, HTML, JSON, and Markdown reports. I am affiliated with the project. Feedback on noisy or missing checks would be useful.
```

**r/SEO**

```text
Open-source AEO/GEO audit checklist + CLI

I made an open-source scanner for AI-agent and answer-engine readiness. It checks classic machine-readable signals such as Schema.org and robots.txt, and newer AI-facing files and action surfaces: llms.txt, OpenAPI, WebMCP, MCP discovery, semantic content structure, and citation-friendly pages.

npx @forkpoint/agent-lighthouse https://example.com --view

I am affiliated with the project. Curious which checks SEOs would consider actionable vs noisy.
```

### Social posts

```text
Launched Agent Lighthouse: Lighthouse, but for AI agents.

It audits whether ChatGPT, Claude, Perplexity, MCP clients, and AI crawlers can discover, parse, cite, and act on your site.

npx @forkpoint/agent-lighthouse https://example.com --view

https://github.com/ForkPoint/agent-lighthouse
```

```text
Most sites are built for browsers and Googlebot. Agent Lighthouse checks the layer AI agents need: llms.txt, robots rules for AI crawlers, Schema.org, OpenAPI, WebMCP, semantic HTML, accessibility, and AEO/GEO content structure.

CLI + SDK + GitHub Action + MCP server:
https://github.com/ForkPoint/agent-lighthouse
```

### Article: How to make a website readable by AI agents

```text
AI agents do not browse sites like humans. They need fast discovery, clear permissions, structured facts, and machine-readable action surfaces.

A practical checklist:

1. Add /llms.txt with a short summary and links to important pages.
2. Publish a complete sitemap and RSS/Atom feed for crawl discovery.
3. Make robots.txt explicit for AI crawlers such as GPTBot, ClaudeBot, PerplexityBot, and OAI-SearchBot.
4. Add Schema.org JSON-LD for Organization, WebSite, Product, Offer, Review, FAQPage, Article, and SearchAction where relevant.
5. Link OpenAPI specs and WebMCP manifests when agents should take actions.
6. Use semantic HTML landmarks, headings, lists, tables, and accessible button/form names.
7. Keep server-rendered content available without heavy client-side interaction.

Test the checklist with Agent Lighthouse:

npx @forkpoint/agent-lighthouse https://example.com --view
```

Keep one caveat in any tutorial: item 1 is cheap and harmless, but no vendor documents an agent that reads `llms.txt`, so Agent Lighthouse reports it without scoring it.

## Outreach email

`{{name}}` is the only placeholder. Lead with the recipient's problem, not the tool. Pick the middle paragraph for the audience.

```text
Subject: Free open-source audit for AI-agent readiness

Hi {{name}},

I am working on Agent Lighthouse, an open-source scanner for whether ChatGPT, Claude, Perplexity, AI crawlers, and MCP clients can discover, understand, and act on a website.

[SEO agencies] It covers llms.txt, AI crawler rules in robots.txt, Schema.org, OpenAPI/WebMCP discovery, semantic HTML, accessibility, and AEO/GEO content structure. It can produce a concrete before/after report for AI visibility work.
[DevRel] It checks docs and product pages for sitemap discovery, AI crawler rules, Schema.org, OpenAPI links, WebMCP/MCP discovery, and accessibility, so docs and APIs are easier for AI coding agents to use.
[Ecommerce] It runs 215 checks across AI crawler access, Product/Offer/Review schema, OpenAPI/WebMCP action surfaces, semantic HTML, and accessible forms, with a standalone HTML report plus JSON/Markdown for CI.

npx @forkpoint/agent-lighthouse https://example.com --view

I would value feedback on which checks are useful or too noisy.

Project: https://github.com/ForkPoint/agent-lighthouse
Docs: https://forkpoint.github.io/agent-lighthouse/
```

## Directory listings

Check each list's contribution rules before opening a PR.

```markdown
- [Agent Lighthouse](https://github.com/ForkPoint/agent-lighthouse) - CLI, SDK, GitHub Action, and MCP server for auditing whether websites are discoverable and usable by AI agents.
- [Agent Lighthouse](https://github.com/ForkPoint/agent-lighthouse) - Open-source scanner for AI-agent readiness: llms.txt, AI crawler robots rules, Schema.org, OpenAPI, WebMCP, semantic HTML, accessibility, AEO, and GEO checks.
- [Agent Lighthouse](https://github.com/ForkPoint/agent-lighthouse) - Lighthouse-style CLI for checking whether ChatGPT, Claude, Perplexity, MCP clients, and AI crawlers can understand a website.
```

Use the first for MCP and agent tooling lists, the second for SEO/AEO/GEO lists, the third for developer tools. Also worth submitting: awesome llms.txt resources, open-source ecommerce tooling lists, and the GitHub Action Marketplace ([listing copy](github-action.md#marketplace-listing)).

## How to post

Lead with a checklist, a benchmark or a teardown. Mention the project after the useful content. Targets: Show HN, Product Hunt, Dev.to, Hashnode, r/webdev, r/node, r/SEO, r/ecommerce, and MCP and AI-agent tooling communities.

Avoid:

- The same link everywhere on the same day
- Asking for upvotes
- Hiding affiliation
- Calling it "AI SEO" without naming concrete checks
- Claiming a signal helps AI visibility when its dossier says no consumer is documented. The evidence discipline is the differentiator.

Article ideas: what `llms.txt`, `robots.txt`, Schema.org, OpenAPI and WebMCP actually do for agents; an agent-readiness gate in GitHub Actions; a before/after score on an ecommerce site; auditing staging from Claude or Cursor over MCP; grading 215 signals by evidence, and how many had no documented consumer.
