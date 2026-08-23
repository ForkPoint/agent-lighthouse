---
check: signal-density-index-content-tokens-delivered-tokens
title: "Signal Density Index (content tokens ÷ delivered tokens)"
domain: token-economics
status: proposed
evidence_grade: B
uniqueness: partial-overlap
difficulty: static-fetch
scoring_tier: scored
reviewed: 2026-08-20
---

# Signal Density Index (content tokens ÷ delivered tokens)

> Proposed check. Evidence grade **B** · partial overlap · implementation: `static-fetch`

## What it checks

Primary meter for the whole category. Tokenize the raw HTTP response body exactly as a non-rendering agent receives it, tokenize the extracted main content, and report the ratio plus the absolute waste in tokens. Grades: A ≥ 0.20, B 0.10-0.20, C 0.04-0.10, F < 0.04. Also emit the absolute numbers (delivered tokens, content tokens, wasted tokens) because a 3% ratio on a 2k-token page is trivia while 3% on a 90k-token page is the whole finding.

## Claimed mechanism (falsifiable)

AI crawlers do not execute JavaScript and do not apply CSS, so the entire HTTP response body — inline scripts, style blocks, serialized state, comments, tracking snippets — is what gets tokenized into the agent's context, and per-document token cost is real enough that infrastructure vendors bill and report it per conversion. If content tokens are a small fraction of delivered tokens, then every retrieval of this page spends most of its context budget on bytes that carry no answer, and irrelevant context measurably degrades model accuracy on top of the cost. Falsifiable: fetch the page with a plain HTTP client, count tokens with o200k_base, and the ratio is a single reproducible number that does not move between runs.

## Evidence

- **[The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler)** — Vercel (study, URL verified 2026-08-20)
  - "none of the major AI crawlers currently render JavaScript" — explicitly GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot — though they do fetch JS files as text (ChatGPT 11.50%, Claude 23.84% of requests). ChatGPT spends 34.82% and Claude 34.16% of fetches on 404s vs Googlebot's 8.22%. Establishes that (a) what an AI crawler ingests is the raw HTML byte stream with no CSS/JS applied, and (b) per-fetch yield is already terrible, so wasted tokens per fetch compound.
- **[Markdown Conversion — REST API usage (Workers AI)](https://developers.cloudflare.com/workers-ai/features/markdown-conversion/usage/rest-api/)** — Cloudflare (vendor-doc, URL verified 2026-08-20)
  - The toMarkdown REST response returns fields id, name, mimeType, format, tokens, data — e.g. "tokens": 49 for a converted HTML file. A major infra vendor bills/reports HTML→markdown conversion in tokens per document, so per-page token count is a first-class, vendor-visible unit.
- **[The /llms.txt file](https://llmstxt.org/)** — Answer.AI (Jeremy Howard) (draft-spec, URL verified 2026-08-20)
  - Defines llms.txt at /llms.txt (or any subpath) in Markdown, with H1 title, optional blockquote summary and H2-delimited link sections. Recommends clean Markdown mirrors 'at the same URL as the original page, either with .md appended (page.html.md) or with the extension replaced by .md (page.md)', and uses type="text/markdown" in link relations. CRITICALLY: the spec states NO requirement for the file's own HTTP Content-Type, no CORS guidance and no caching guidance — so any content-type audit is enforcing convention, not spec.
- **[openai/tiktoken](https://github.com/openai/tiktoken)** — OpenAI (repo, URL verified 2026-08-20)
  - Fast BPE tokenizer with cl100k_base and o200k_base encodings and encoding_for_model(); counts tokens fully offline, 3-6x faster than comparable tokenizers. Makes every token metric in this domain deterministic, reproducible and CI-friendly with no network or model call.
- **[Large Language Models Can Be Easily Distracted by Irrelevant Context](https://arxiv.org/abs/2302.00093)** — Shi et al., ICML 2023 (arXiv 2302.00093) (study, URL verified 2026-08-20)
  - Introduces GSM-IC; finds "the model performance is dramatically decreased when irrelevant information is included" in the prompt, mitigated only partially by self-consistency and explicit ignore-instructions. Grounds the claim that boilerplate/duplicate/hidden text in an ingested page degrades answer quality, not just cost.
- **[Web Almanac 2024 — Page Weight](https://almanac.httparchive.org/en/2024/page-weight)** — HTTP Archive (dataset, URL verified 2026-08-20)
  - Median total page 2,652 kB desktop / 2,311 kB mobile; p90 8,375 kB / 7,680 kB; median desktop homepage loads ~18 kB of HTML against ~1,054 kB images and ~613 kB JS. Useful contrast: for a rendering browser HTML is ~1% of weight, but for a non-rendering AI crawler that HTML document is ~100% of what gets tokenized — so HTML-internal waste is the entire agent-side cost.
- **[Scrape — output formats](https://docs.firecrawl.dev/features/scrape)** — Firecrawl (vendor-doc, URL verified 2026-08-20)
  - Offers markdown, html ("cleaned version of the page's HTML"), rawHtml ("unmodified HTML as received"), summary, links, json. Confirms the three-way distinction (raw HTML / cleaned HTML / markdown) that a markup-to-content token ratio measures.

## Competitor coverage

Classic SEO crawlers (Screaming Frog and similar) ship a byte-based 'text ratio' computed on stripped tag text, which is a different and much weaker quantity: it uses bytes not BPE tokens, uses naive tag-stripping not main-content extraction, and has no agent framing. Lighthouse's Agentic Browsing category has no token metric at all; Profound/Otterly measure off-site answer visibility and citations, not page payload economics.

## Implementation sketch

HTTP GET with an AI-crawler UA and Accept-Encoding identity-or-decompressed; keep the decoded body as the denominator string. Parse with linkedom/cheerio, run @mozilla/readability over the DOM for textContent as numerator, fall back to a <main>/<article>/[role=main] selector when readability returns null. Count both with gpt-tokenizer or js-tiktoken at o200k_base. Report a breakdown of the denominator by node type (script, style, comment, attribute text, visible text) so the report tells the user which bucket to attack — this breakdown is what makes the other checks in this set actionable.

## Example failure

A Shopify product page returns 780 kB of uncompressed HTML that tokenizes to ~210k tokens; readability extracts a 900-token description and spec list. Ratio 0.004: an answer engine spends 200k+ tokens to learn one paragraph, and the page alone overflows most retrieval budgets so it gets truncated mid-markup.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
