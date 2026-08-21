---
check: enterprise-seo-suites-semrush-conductor-seoclarity-log-based
title: "Enterprise SEO suites (Semrush, Conductor, seoClarity) — log-based bot analytics"
domain: competitor-gap-verify
status: proposed
evidence_grade: A
uniqueness: commodity
difficulty: multi-page
scoring_tier: informative (weight 0)
reviewed: 2026-08-20
---

# Enterprise SEO suites (Semrush, Conductor, seoClarity) — log-based bot analytics

> Proposed check. Evidence grade **A** · commodity · implementation: `multi-page`

## What it checks

Semrush AI Visibility Toolkit ships Visibility Overview, Brand Performance, Competitor Research, Prompt Tracking, AI-Cited Media, Prompt Research; the classic Site Audit is cross-sold separately for generic 'technical health' and the AI toolkit page documents no AI-bot-specific check. Conductor ships Conductor Intelligence (multi-engine visibility), Creator, AgentStack, and Conductor Monitoring — '24/7 always-on monitoring tracks how AI bots crawl your site' with alerts and prioritised fixes, i.e. telemetry on arrived bots. seoClarity's Clarity ArcAI ships 12 modules: Track Visibility, Research Prompts, Analyze Sentiment, Optimize Content, Measure Performance, Discover Bot Activity ('know if AI bots access your pages'), Monitor Accuracy, MCP Server and API, Accelerate Indexation, Monitor Web Mentions, Track AI Shopping, Product Feed Optimizer.

## Claimed mechanism (falsifiable)

Falsifiable: the closest thing any of the three ships to our category is bot-activity tracking, which answers 'did GPTBot fetch /pricing last week' from server logs. It cannot answer 'would GPTBot be allowed to fetch /pricing right now, and would the CDN honour that', because that requires an outbound request the platform does not make. A site whose AI bots have never once arrived produces an empty Conductor/seoClarity bot report and no diagnosis.

## Evidence

- **[Semrush AI Visibility Toolkit](https://www.semrush.com/features/ai-visibility/)** — Semrush (vendor-doc, URL verified 2026-08-20)
  - Visibility Overview, Brand Performance, Competitor Research, Prompt Tracking, AI-Cited Media, Prompt Research. The page cross-sells the separate classic Site Audit for 'technical health' but documents no AI-bot-specific crawlability, llms.txt or agent-schema checks inside the AI toolkit.
- **[Conductor platform](https://www.conductor.com/)** — Conductor (vendor-doc, URL verified 2026-08-20)
  - Conductor Intelligence (visibility across ChatGPT/Gemini/Copilot/Claude), Conductor Creator, Conductor Monitoring ('24/7 monitoring tracks how AI bots crawl your site' — log/edge telemetry plus alerts), Conductor AgentStack. The only technical surface is passive bot-crawl monitoring; no documented llms.txt/schema/agent-protocol conformance audits.
- **[seoClarity Clarity ArcAI suite](https://www.seoclarity.net/)** — seoClarity (vendor-doc, URL verified 2026-08-20)
  - 12 named modules: Track Visibility, Research Prompts, Analyze Sentiment, Optimize Content, Measure Performance, Discover Bot Activity (/ai-seo/ai-bot-activity-tracking — 'know if AI bots access your pages', log-based), Monitor Accuracy, MCP Server and API, Accelerate Indexation, Monitor Web Mentions, Track AI Shopping, Product Feed Optimizer. Bot Activity is observational, not a conformance audit.
- **[Profound — AI visibility platform](https://www.tryprofound.com/)** — Profound (vendor-doc, URL verified 2026-08-20)
  - Shipped features: Answer Engine Insights, Prompt Volumes, Agent Analytics (crawl frequency by bot, from the customer's own logs/edge), Shopping, Agents (content generation), Aim (task prioritisation). Zero active site-side audits: no robots.txt parsing, no llms.txt validation, no schema checks, no differential fetching.

## Competitor coverage

Semrush, Conductor, seoClarity; also Profound Agent Analytics and any Cloudflare AI Audit dashboard.

## Implementation sketch

n/a — competitor mapping. Their moat is longitudinal log data we will never have; ours is the point-in-time, pre-deploy, CI-runnable assertion they cannot make. This is why the differentiating checks below are all active-probe checks.

## Example failure

Claiming 'nobody tracks AI bot access'. All three do, retrospectively. The honest claim is that nobody tests AI bot access prospectively.

## Scoring

Tier per evidence policy: **informative (weight 0)** — grade A does not meet the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
