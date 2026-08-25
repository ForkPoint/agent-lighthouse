# Media kit

Everything needed to write about Agent Lighthouse: the boilerplate, the assets,
and ready drafts for launch posts, outreach and directory listings.

One positioning line carries all of it:

> Lighthouse, but for AI agents.

The demo is the product:

```bash
npx @forkpoint/agent-lighthouse https://yourstore.com --view
```

## Facts

|                  |                                                                          |
| :--------------- | :----------------------------------------------------------------------- |
| What it is       | Open-source CLI, SDK, GitHub Action and MCP server                       |
| What it does     | Audits whether AI agents can discover, parse, cite and act on a website  |
| Checks           | 215 audits across 8 categories, each backed by a public evidence dossier |
| Outputs          | Terminal, HTML, JSON and Markdown reports                                |
| Licence          | MIT                                                                      |
| Repository       | https://github.com/ForkPoint/agent-lighthouse                            |
| Documentation    | https://forkpoint.github.io/agent-lighthouse/                            |
| npm — CLI        | https://www.npmjs.com/package/@forkpoint/agent-lighthouse                |
| npm — MCP server | https://www.npmjs.com/package/@forkpoint/agent-lighthouse-mcp            |

Keep the audit count current. It is `215` today, and the authority is the
registry, not this file.

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

Still worth capturing: a GitHub Actions PR comment, an MCP scan running inside
Claude or Cursor, and one before/after score on a real site.

Related pages: [badge](badge.md) · [GitHub Action](github-action.md) ·
[benchmark](benchmark.md) · [scoring](scoring.md)

## Launch drafts

### Show HN

Title:

```text
Show HN: Agent Lighthouse - audit websites for AI-agent readiness
```

Comment:

```text
Hi HN, we built Agent Lighthouse: a Lighthouse-style CLI for checking whether AI agents and LLM crawlers can understand and act on a website.

It runs 215 checks across llms.txt, robots.txt policies for GPTBot/ClaudeBot/PerplexityBot, Schema.org, OpenAPI, WebMCP, AEO/GEO structure, agentic commerce, and agent operability.

Try it with:

npx @forkpoint/agent-lighthouse https://yourstore.com --view

It outputs terminal, HTML, JSON, and Markdown reports, so it can run locally or in CI. There is also an MCP server for Claude/Cursor-style workflows.

Every check publishes the evidence behind it, including the ones we found no documented consumer for — those are reported and never scored.

We are looking for feedback on which agent-readiness checks are useful, noisy, or missing.
```

### Product Hunt

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
Run 215 checks to see whether AI agents, LLM crawlers, MCP clients, and agentic browsers can discover, parse, cite, and act on your website. Includes CLI, SDK, GitHub Action, MCP server, and standalone HTML reports.
```

Maker comment:

```text
Agent Lighthouse helps developers catch the parts of a website that block AI agents: missing llms.txt, blocked AI crawlers, weak Schema.org data, missing OpenAPI/WebMCP discovery, poor semantic HTML, inaccessible controls, and content that is hard for answer/generative engines to cite.

Try:
npx @forkpoint/agent-lighthouse https://yourstore.com --view

We would especially value feedback from SEO, ecommerce, DevRel, and platform teams.
```

### Reddit

Adapt per community and disclose affiliation. Do not cross-post one text.

**r/webdev**

```text
I built an open-source checker for whether websites are usable by AI agents

Most web tooling checks browser UX, SEO, or performance. I wanted a concrete way to test the newer agent-facing layer: llms.txt, robots rules for GPTBot/ClaudeBot/PerplexityBot, Schema.org, OpenAPI/WebMCP discovery, semantic HTML, accessible controls, and content structure for answer engines.

The tool is called Agent Lighthouse:
npx @forkpoint/agent-lighthouse https://example.com --view

It outputs terminal, HTML, JSON, and Markdown reports. I am affiliated with the project. Feedback on noisy or missing checks would be useful.
```

**r/SEO**

```text
Open-source AEO/GEO audit checklist + CLI

I made an open-source scanner for AI-agent and answer-engine readiness. It checks classic machine-readable signals such as Schema.org and robots.txt, but also newer AI-facing files and action surfaces: llms.txt, OpenAPI, WebMCP, MCP discovery, semantic content structure, and citation-friendly pages.

CLI:
npx @forkpoint/agent-lighthouse https://example.com --view

I am affiliated with the project. Curious which checks SEOs would consider actionable vs noisy.
```

### Social posts

**Short**

```text
Launched Agent Lighthouse: Lighthouse, but for AI agents.

It audits whether ChatGPT, Claude, Perplexity, MCP clients, and AI crawlers can discover, parse, cite, and act on your site.

npx @forkpoint/agent-lighthouse https://yourstore.com --view

https://github.com/ForkPoint/agent-lighthouse
```

**Developer angle**

```text
Most sites are built for browsers and Googlebot. Agent Lighthouse checks the layer now needed for AI agents: llms.txt, robots rules for AI crawlers, Schema.org, OpenAPI, WebMCP, semantic HTML, accessibility, and AEO/GEO content structure.

CLI + SDK + GitHub Action + MCP server:
https://github.com/ForkPoint/agent-lighthouse
```

**Benchmark angle**

```text
We are benchmarking how agent-ready public websites are across 215 checks: llms.txt, AI crawler access, Schema.org, OpenAPI/WebMCP, agentic commerce, and agent operability.

Tool is open source:
https://github.com/ForkPoint/agent-lighthouse
```

### Dev.to / Hashnode article

Title: **How to make a website readable by AI agents**

```text
AI agents do not browse sites like humans. They need fast discovery, clear permissions, structured facts, and machine-readable action surfaces.

Here is a practical checklist:

1. Add /llms.txt with a short summary and links to important pages.
2. Publish a complete sitemap and RSS/Atom feed for crawl discovery.
3. Make robots.txt explicit for AI crawlers such as GPTBot, ClaudeBot, PerplexityBot, and OAI-SearchBot.
4. Add Schema.org JSON-LD for Organization, WebSite, Product, Offer, Review, FAQPage, Article, and SearchAction where relevant.
5. Link OpenAPI specs and WebMCP manifests when agents should take actions.
6. Use semantic HTML landmarks, headings, lists, tables, and accessible button/form names.
7. Keep server-rendered content available without heavy client-side interaction.

You can test the checklist with Agent Lighthouse:

npx @forkpoint/agent-lighthouse https://example.com --view

The report gives terminal, HTML, JSON, and Markdown outputs and can run locally, in CI, or through an MCP server in Claude/Cursor-style workflows.
```

One honest caveat worth keeping in any tutorial: item 1 is cheap and harmless,
but no vendor documents an agent that reads `llms.txt`, and Agent Lighthouse
reports it without scoring it for exactly that reason.

## Outreach emails

`{{name}}` is the only placeholder. Lead with the recipient's problem, not the
tool.

### SEO agencies

Subject: `Free open-source audit for AI-agent readiness`

```text
Hi {{name}},

I am working on Agent Lighthouse, an open-source scanner for AI-agent readiness. It checks whether ChatGPT, Claude, Perplexity, AI crawlers, and MCP clients can discover and understand a site.

It covers llms.txt, robots.txt AI crawler policy, Schema.org, OpenAPI/WebMCP discovery, semantic HTML, accessibility, and AEO/GEO content structure.

CLI:
npx @forkpoint/agent-lighthouse https://example.com --view

If you work with ecommerce or SaaS clients, this can produce a concrete before/after report for AI visibility work. I would value feedback on which checks are useful or too noisy.

Project: https://github.com/ForkPoint/agent-lighthouse
Docs: https://forkpoint.github.io/agent-lighthouse/
```

### DevRel and developer platforms

Subject: `Can your docs/API be discovered by AI agents?`

```text
Hi {{name}},

I am building Agent Lighthouse, an open-source CLI and MCP server for auditing whether AI agents can discover, cite, and act on a website or developer platform.

It checks docs and product pages for llms.txt, sitemap discovery, robots rules for AI crawlers, Schema.org, OpenAPI links, WebMCP/MCP discovery, semantic HTML, and accessibility.

Try:
npx @forkpoint/agent-lighthouse https://docs.example.com --view

I think this may be useful for DevRel teams who want their docs and APIs to be easier for AI coding agents to use. Feedback welcome.

https://github.com/ForkPoint/agent-lighthouse
```

### Ecommerce platforms

Subject: `Agent-readiness checks for storefronts`

```text
Hi {{name}},

I am working on Agent Lighthouse, an open-source scanner for storefronts that want to be discoverable and usable by AI shopping agents.

It runs 215 checks across llms.txt, AI crawler access, Product/Offer/Review schema, OpenAPI/WebMCP action surfaces, semantic HTML, accessible forms/buttons, and technical readiness.

CLI:
npx @forkpoint/agent-lighthouse https://store.example.com --preset ecommerce --view

The output is a standalone HTML report plus JSON/Markdown for CI or client delivery.

Project: https://github.com/ForkPoint/agent-lighthouse
```

## Directory listings

Check each repository's contribution rules before opening a PR.

**MCP and agent tooling**

```markdown
- [Agent Lighthouse](https://github.com/ForkPoint/agent-lighthouse) - CLI, SDK, GitHub Action, and MCP server for auditing whether websites are discoverable and usable by AI agents.
```

**SEO / AEO / GEO tools**

```markdown
- [Agent Lighthouse](https://github.com/ForkPoint/agent-lighthouse) - Open-source scanner for AI-agent readiness: llms.txt, AI crawler robots rules, Schema.org, OpenAPI, WebMCP, semantic HTML, accessibility, AEO, and GEO checks.
```

**Developer tools**

```markdown
- [Agent Lighthouse](https://github.com/ForkPoint/agent-lighthouse) - Lighthouse-style CLI for checking whether ChatGPT, Claude, Perplexity, MCP clients, and AI crawlers can understand a website.
```

Worth submitting to: awesome MCP servers and clients, awesome llms.txt
resources, awesome SEO tools, awesome developer tools, AI-agent tooling
directories, open-source ecommerce tooling lists, and the GitHub Action
Marketplace — see [github-action.md](github-action.md) for the listing copy.

## How to post

Lead with a checklist, a benchmark or a teardown. Mention the project after the
useful content.

Good targets: Hacker News Show HN · Product Hunt · Dev.to and Hashnode ·
r/webdev · r/node · r/SEO · r/ecommerce · MCP and AI-agent tooling communities.

Avoid:

- The same link everywhere on the same day
- Asking for upvotes
- Hiding affiliation
- Calling it "AI SEO" without naming concrete checks
- Claiming a signal helps AI visibility when the project's own dossier says no
  consumer is documented. The evidence discipline is the differentiator; a
  post that overclaims throws it away.

## Article ideas

- How to make your website readable by AI agents
- What `llms.txt`, `robots.txt`, Schema.org, OpenAPI and WebMCP actually do for AI agents
- Adding an AI-agent readiness gate to GitHub Actions
- Before and after: raising an ecommerce site's agent-readiness score
- Auditing a staging site from Claude or Cursor over MCP
- What we found grading 215 AI-readiness signals by evidence, and how many had no documented consumer
