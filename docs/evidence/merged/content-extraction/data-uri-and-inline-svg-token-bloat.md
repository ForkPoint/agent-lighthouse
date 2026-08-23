---
check: data-uri-and-inline-svg-token-bloat
title: "Data-URI and inline-SVG token bloat"
domain: token-economics
status: proposed
evidence_grade: B
uniqueness: unique
difficulty: static-fetch
scoring_tier: scored
reviewed: 2026-08-20
---

# Data-URI and inline-SVG token bloat

> Proposed check. Evidence grade **B** · unique · implementation: `static-fetch`

## What it checks

Sum the tokens consumed by base64/data: URIs (img src, srcset, CSS url() in inline styles and inline <style>, <use href>, favicon links) and by inline SVG geometry (path d=, points=, and long transform/filter chains). Fail on any of: total data-URI tokens > 5% of document tokens, any single data URI > 1,000 tokens, or inline SVG path data > 2,000 tokens. Report the top offenders by token count with their source location.

## Claimed mechanism (falsifiable)

Base64 and SVG path data are the most token-hostile byte sequences on the web: they are high-entropy ASCII with no lexical structure, so BPE compresses them barely at all — roughly one token per 2-3 characters, far worse than prose. A single 40 kB inlined logo can cost more tokens than an entire article. Two extraction vendors independently treat this as pure waste and delete it by default (removeBase64Images defaults to true; a header exists specifically to strip images 'to reduce token usage'), which proves the cost is real — but those defaults protect only agents that route through those vendors. A crawler using a plain HTTP client, or a generic HTML→markdown converter that passes img src through, ingests every byte. Falsifiable per page by tokenizing the matched substrings.

## Evidence

- **[Scrape endpoint API reference](https://docs.firecrawl.dev/api-reference/endpoint/scrape)** — Firecrawl (vendor-doc, URL verified 2026-08-20)
  - onlyMainContent default: true (excludes headers, navs, footers via HTML-level filtering, no LLM); removeBase64Images default: true ("Removes all base 64 images from the markdown output"); blockAds default: true; the cleaned html format "Removes <script>, <style>, <noscript>, <meta>, and <head> tags". A commercial extraction vendor defaults to deleting base64 images and chrome — direct evidence these are treated as pure token waste.
- **[Jina Reader (r.jina.ai)](https://jina.ai/reader/)** — Jina AI (vendor-doc, URL verified 2026-08-20)
  - Converts URLs to "clean, LLM-ready" markdown because "raw HTML is cluttered with extraneous elements". Documents X-Target-Selector ("Only extract content matching these CSS selectors"), X-Remove-Selector ("Remove these elements before extraction"), X-Retain-Images ("Strip all images from the output" to reduce token usage), X-Return-Format, X-With-Images-Summary. Token cost of images/boilerplate is an explicit product knob.
- **[openai/tiktoken](https://github.com/openai/tiktoken)** — OpenAI (repo, URL verified 2026-08-20)
  - Fast BPE tokenizer with cl100k_base and o200k_base encodings and encoding_for_model(); counts tokens fully offline, 3-6x faster than comparable tokenizers. Makes every token metric in this domain deterministic, reproducible and CI-friendly with no network or model call.
- **[Web Almanac 2024 — Markup](https://almanac.httparchive.org/en/2024/markup)** — HTTP Archive (dataset, URL verified 2026-08-20)
  - Median 594 elements per mobile page (p90 1,716); median HTML transfer size 33 kB desktop / 32 kB mobile; 10.5% of mobile pages serve HTML uncompressed; 86% of mobile pages contain at least one HTML comment and 26% still ship IE conditional comments; SVG present on 51.6% of pages. Population baseline for calibrating per-page token budgets and for the claim that dead markup ships at scale.
- **[Markdown Conversion — supported formats](https://developers.cloudflare.com/workers-ai/features/markdown-conversion/supported-formats/)** — Cloudflare (vendor-doc, URL verified 2026-08-20)
  - text/html (.html/.htm) is an accepted input MIME type alongside PDF, images, Office and CSV. Conversion methodology is not documented, i.e. no guarantee that data: URIs, hidden DOM or JSON script blocks are stripped before tokenization.

## Competitor coverage

Lighthouse performance audits size images in bytes and recommend modern formats; none of them distinguish inlined data URIs as a context-window cost, and byte-oriented advice actively encourages inlining small assets to save requests — advice that is correct for browsers and backwards for agents. No AI-readiness tool measures this.

## Implementation sketch

Regex the decoded body for /data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+\/=]{200,}/ and for data: URIs inside style attributes and <style> blocks; tokenize each match at o200k_base. Parse the DOM and sum token counts of d/points attributes on svg descendants. Compare against total document tokens from the Signal Density check so the numbers reconcile across the report. Recommendation text should be agent-specific: move the asset to a real URL with descriptive alt text, since a URL plus alt costs ~15 tokens and conveys strictly more to a model than 4,000 tokens of base64 ever will.

## Example failure

A marketing page inlines a base64 hero image (~52 kB → ~19k tokens) and 14 inline icon SVGs with full path geometry (~7k tokens) into a document whose actual copy is 800 tokens. 97% of the agent's context spend on that page is opaque binary noise that no model can interpret.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
