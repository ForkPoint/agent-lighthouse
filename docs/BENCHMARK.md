# 100-Store Agentic Readiness Benchmark

This benchmark is the promotion-friendly story for Agent Lighthouse: most stores are readable by browsers and search crawlers, but not yet ready for autonomous AI agents.

## Headline Findings

| Finding | Result |
| :-- | --: |
| Stores with OpenAPI, WebMCP, or MCP action surfaces | 0% |
| Stores with `llms.txt` or `llms-full.txt` | 4% |
| Average agent-readiness score | 53.6 / 100 |
| Fastest practical score lift | `llms.txt`, AI catalog, accessible icon buttons |

These figures come from the pre-v2 run. v2 changed the registry, the pass conditions, and the scoring formula, so the average score is not comparable to a v2 scan; re-run the script to refresh it.

## What The Benchmark Checks

Agent Lighthouse evaluates 148 audits across 8 agent-journey categories:

- Access & Crawl Control: robots.txt rules for GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, Applebot-Extended, and related crawlers.
- Content Extraction: clean main content, semantic structure, render cost, response time.
- Machine Discovery: `llms.txt`, `llms-full.txt`, sitemaps, RSS, `.well-known` surfaces, AI-file delivery.
- Structured Data: Schema.org Product, Offer, Review, Organization, Article, FAQPage, JSON-LD validity.
- Answer Readiness: direct answerability, step lists, comparison tables, unique data, citations, authorship.
- Agent Interfaces: OpenAPI, WebMCP, MCP discovery, agents.json, AI catalogs, search endpoints.
- Agentic Commerce: product offers, availability, and transaction certainty.
- Agent Operability & Safety: HTTPS, security headers, accessible controls, forms, broken agent endpoints.

## Narrative For Promotion

Traditional ecommerce sites are optimized for human browsing and Google search. Agent Lighthouse shows the missing layer for AI-driven discovery and task completion. A site can have strong Product schema and still fail because agents cannot find `llms.txt`, cannot access crawler-safe content, or cannot discover any machine-readable action surface.

## Reproduce

```bash
pnpm tsx scripts/benchmark-100-stores.ts
```

The script writes incremental output to:

```text
reports/investigation/benchmark-100-stores-data.json
```

## Post Copy

```text
We benchmarked 100 ecommerce storefronts for AI-agent readiness.

The pattern: most sites have classic SEO basics, but almost none expose the files and action surfaces AI agents need: llms.txt, OpenAPI, WebMCP, MCP discovery, and clean machine-readable interaction paths.

Tool: https://github.com/ForkPoint/agent-lighthouse
```
