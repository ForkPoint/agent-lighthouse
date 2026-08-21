---
check: ai-visibility-monitors-otterly-ai-peec-ai-ahrefs-brand-radar
title: "AI-visibility monitors (Otterly.ai, Peec AI, Ahrefs Brand Radar, HubSpot AI Search Grader)"
domain: competitor-gap-verify
status: proposed
evidence_grade: A
uniqueness: commodity
difficulty: llm-assisted
scoring_tier: informative (weight 0)
reviewed: 2026-08-20
---

# AI-visibility monitors (Otterly.ai, Peec AI, Ahrefs Brand Radar, HubSpot AI Search Grader)

> Proposed check. Evidence grade **A** · commodity · implementation: `llm-assisted`

## What it checks

Four products, one shape: prompt-rank and citation monitoring with zero technical crawl. Otterly.ai — 7 engines monitored, AI Prompt Research, AI Search Analytics, GEO Optimization, and a 'Content Audit' that advertises unspecified 'crawlability checks' plus a predictive citation score; no named technical check anywhere in its docs. Peec AI — Prompt Management, per-model trackers, competitor benchmarking, Visibility/Position/Sentiment, geo tracking, source detection, CSV export, Looker connector, API; explicitly no site audit. Ahrefs Brand Radar — AI visibility tracking, citation discovery, YouTube/TikTok/Reddit monitoring, custom prompts; explicitly no llms.txt, no AI-bot robots.txt rules, no agent schema. HubSpot AI Search Grader — a 100-point score over Sentiment Results (40), Presence Quality (20), Brand Recognition (20), Share of Voice (10), Market Competition (10), computed entirely by prompting ChatGPT/Perplexity/Gemini; it never fetches the graded site.

## Claimed mechanism (falsifiable)

Falsifiable: point any of these four at a domain that returns HTTP 403 to every AI crawler UA while serving 200 to browsers. All four will still produce a full report, and none will report the block, because none of them issue a request to the site under a crawler user-agent. Their inputs are model outputs, not the origin server.

## Evidence

- **[Otterly.ai](https://otterly.ai/)** — Otterly.ai (vendor-doc, URL verified 2026-08-20)
  - Monitors 7 engines (ChatGPT, Google AI Overviews, AI Mode, Gemini, Perplexity, Copilot, Claude via API). Features: AI Prompt Research, AI Search Analytics, Content Audit (advertises 'crawlability checks' and a predictive citation score), GEO Optimization. Marketing names no specific technical check — no robots.txt, llms.txt, schema or bot-access validation is documented.
- **[Peec AI](https://peec.ai/)** — Peec AI (vendor-doc, URL verified 2026-08-20)
  - Exclusively prompt-rank monitoring: Prompt Management, per-model trackers (ChatGPT/Perplexity/Gemini), competitor benchmarking, Visibility/Position/Sentiment metrics, geo tracking, source detection, CSV export, Looker Studio connector, API. No technical site audit of any kind.
- **[Ahrefs Brand Radar](https://ahrefs.com/brand-radar)** — Ahrefs (vendor-doc, URL verified 2026-08-20)
  - AI visibility tracking, competitive benchmarking, AI citation discovery, YouTube/TikTok/Reddit monitoring, custom prompts, dashboard. Explicitly no llms.txt, no AI-bot robots.txt rules, no agent schema audits.
- **[HubSpot AI Search Grader](https://www.hubspot.com/ai-search-grader)** — HubSpot (vendor-doc, URL verified 2026-08-20)
  - Scores 100 points across 5 dimensions: Sentiment Results (40), Presence Quality (20), Brand Recognition (20), Share of Voice (10), Market Competition (10). Queries ChatGPT/Perplexity/Gemini about the brand. Performs no crawl of the site at all — no robots.txt, llms.txt or schema inspection.

## Competitor coverage

Otterly.ai, Peec AI, Ahrefs, HubSpot — the crowded, funded end of the market, and the end we should not compete in.

## Implementation sketch

n/a — competitor mapping. Only Otterly's vague 'crawlability checks' is a possible collision; it is undocumented, so treat any specific, named, reproducible crawl assertion as safe to claim.

## Example failure

Claiming uniqueness for 'we tell you if AI mentions your brand'. That is exactly what all four ship and we do not.

## Scoring

Tier per evidence policy: **informative (weight 0)** — grade A does not meet the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
