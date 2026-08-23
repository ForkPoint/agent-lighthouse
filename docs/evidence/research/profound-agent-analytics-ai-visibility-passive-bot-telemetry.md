---
check: profound-agent-analytics-ai-visibility-passive-bot-telemetry
title: "Profound — Agent Analytics (AI visibility + passive bot telemetry)"
domain: competitor-gap-verify
status: research
evidence_grade: A
reviewed: 2026-08-20
archived: 2026-08-22
---

# Profound — Agent Analytics (AI visibility + passive bot telemetry)

> Proposed check. Evidence grade **A** · commodity · implementation: `llm-assisted`

## What it checks

Shipped surface: Answer Engine Insights (how AI describes the brand across Perplexity, ChatGPT, Claude, Gemini, Grok, Copilot, DeepSeek, AI Overviews), Prompt Volumes, Agent Analytics ('track how your site is interpreted and crawled by ChatGPT, Gemini, Claude, Perplexity'), Shopping (SKU visibility in AI answers), Agents (AEO FAQ generator, Demand Gen, Brand, Content agents), and Aim (weekly prioritised task list). Agent Analytics is derived from the customer's own request logs / edge integration — it observes bots that already arrived. There is no active site-side conformance audit anywhere in the product: no robots.txt parsing, no llms.txt validation, no schema conformance, no differential fetching.

## Claimed mechanism (falsifiable)

Falsifiable: Profound's product surface requires either an account's log/edge feed or LLM querying; nothing in it can be run against an arbitrary third-party URL to produce a pass/fail technical finding. Therefore a check that is an unauthenticated, deterministic HTTP-level assertion about a stranger's site is structurally outside Profound's product, not merely absent from it.

## Evidence

- **[Profound — AI visibility platform](https://www.tryprofound.com/)** — Profound (vendor-doc, URL verified 2026-08-20)
  - Shipped features: Answer Engine Insights, Prompt Volumes, Agent Analytics (crawl frequency by bot, from the customer's own logs/edge), Shopping, Agents (content generation), Aim (task prioritisation). Zero active site-side audits: no robots.txt parsing, no llms.txt validation, no schema checks, no differential fetching.

## Competitor coverage

Profound; the same shape as Conductor Monitoring and seoClarity's 'Discover Bot Activity'.

## Implementation sketch

n/a — competitor mapping. Strategic read: Profound owns the 'did the bot come, and what did the model say' half; Agent Lighthouse should own the 'what will the bot get when it arrives' half, and the two are complements, not substitutes.

## Example failure

Positioning Agent Lighthouse against Profound on 'AI visibility'. We cannot measure share-of-voice in ChatGPT answers, and they cannot tell you your CDN 403s ClaudeBot.

## Scoring

Tier per evidence policy: **informative (weight 0)** — grade A does not meet the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
