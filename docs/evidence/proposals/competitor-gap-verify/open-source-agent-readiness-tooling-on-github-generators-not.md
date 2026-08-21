---
check: open-source-agent-readiness-tooling-on-github-generators-not
title: "Open-source agent-readiness tooling on GitHub — generators, not auditors"
domain: competitor-gap-verify
status: proposed
evidence_grade: A
uniqueness: commodity
difficulty: static-fetch
scoring_tier: informative (weight 0)
reviewed: 2026-08-20
---

# Open-source agent-readiness tooling on GitHub — generators, not auditors

> Proposed check. Evidence grade **A** · commodity · implementation: `static-fetch`

## What it checks

A GitHub REST search census of the field. The high-star projects are all generators or the spec itself: AnswerDotAI/llms-txt (2575 stars, the llms.txt spec repo), firecrawl/llmstxt-generator (537), delucis/starlight-llms-txt (109), SecretiveShell/Awesome-llms-txt (107), thedaviddias/mcp-llms-txt-explorer (76). Every auditor-shaped project is a sub-5-star weekend build: hanselhansel/context-cli (robots.txt + llms.txt + Schema.org + content density scored 0-100, with an MCP server), agentmarkup/agentmarkup (22 stars, build-time llms.txt/JSON-LD/markdown-mirror generation plus validation for Vite/Astro/Next/Nuxt), portdeveloper/llms-txt-check (1 star, 'validate a site's llms.txt against what the site actually serves'), mikiships/agent-trust-scan (1, A2A + MCP + llms.txt endpoint validation as a GitHub Action), abhi725/growth-mcp (1, GEO readiness audits over MCP), javaidnaik/llmstxt-kit (1), JerryZhi/AI-Crawler-Detector (5, detects server-side AI crawler blocking beyond robots.txt), arturseo-geo/mcp-crawl-parity (1, Googlebot vs AI crawler parity computed from Nginx logs + GSC).

## Claimed mechanism (falsifiable)

Falsifiable: run the search and sort by stars. The distribution — thousands of stars for generation, single digits for auditing — shows the market has tooling to PRODUCE llms.txt and none to VERIFY that the resulting site actually serves agents correctly. Two repos nibble at our differentiators (AI-Crawler-Detector at active block detection, mcp-crawl-parity at crawl parity) but neither reconciles an active probe against the site's own declared robots.txt policy, and mcp-crawl-parity requires the operator's server logs.

## Evidence

- **[GitHub repository census — llms.txt / MCP / agent-readiness auditing tools](https://github.com/search?q=llms.txt+validator&type=repositories)** — GitHub (queried via GitHub REST search API) (dataset, URL verified 2026-08-20)
  - Enumerated via gh api search/repositories. The field is generators, not auditors: AnswerDotAI/llms-txt (2575*, the spec itself), firecrawl/llmstxt-generator (537*), delucis/starlight-llms-txt (109*), thedaviddias/mcp-llms-txt-explorer (76*). Auditor-shaped projects are all <5 stars: hanselhansel/context-cli (robots+llms.txt+Schema.org+content density, 0-100), agentmarkup/agentmarkup (22*, build-time generation+validation), portdeveloper/llms-txt-check (1*, validates llms.txt against what the site actually serves), mikiships/agent-trust-scan (1*, A2A+MCP+llms.txt endpoint validation), abhi725/growth-mcp (1*), JerryZhi/AI-Crawler-Detector (5*, detects server-side AI crawler blocking beyond robots.txt), arturseo-geo/mcp-crawl-parity (1*, Googlebot vs AI crawler parity from Nginx logs). No project combines active differential fetching with robots.txt policy reconciliation.

## Competitor coverage

GitHub OSS ecosystem; prior art on active block detection exists but is unmaintained and toy-scale.

## Implementation sketch

n/a — competitor mapping. Practical consequence: llms.txt existence/format checks are saturated (dozens of validators plus Lighthouse), so llms.txt should be a low-weight commodity block in our score, and weight should move to the active-probe and cross-artifact-reconciliation checks below, which have literally no maintained implementation.

## Example failure

Marketing 'the first open-source llms.txt validator'. There are at least ten, plus Lighthouse. The defensible open-source claim is 'the first that checks whether the crawler you wrote llms.txt for can actually reach the site'.

## Scoring

Tier per evidence policy: **informative (weight 0)** — grade A does not meet the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
