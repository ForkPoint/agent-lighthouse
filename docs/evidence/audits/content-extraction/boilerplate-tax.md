---
audit: content-extraction/boilerplate-tax
category: content-extraction
source_file: packages/core/src/audits/content-extraction/boilerplate-tax.ts
slug: boilerplate-tax
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - vercel-rise-of-ai-crawler
  - llmstxt-spec-link
  - trafilatura-eval
  - tiktoken
  - almanac-markup-2024
  - s18
  - openai-searchbot-ips
---

# Boilerplate tax across the crawl (unique tokens per fetch)

> Shipped in v2. Evidence grade **B** · scored tier · partial overlap · implementation: `multi-page`

## What it checks

Site-level rather than page-level. Sample 10-30 URLs across templates. Identify shingles present on 80% or more of the sampled pages — the repeated chrome. Report boilerplate token share, unique tokens per fetch, and the total tokens an agent must spend to acquire the site's distinct information. Fail if unique content is < 20% of tokens fetched, or if median unique tokens per page < 300 (thin pages that force many fetches for little yield). Emit a cost line in tokens and, optionally, dollars at a user-supplied per-million rate.

## Claimed mechanism (falsifiable)

An agent answering a question rarely fetches one page; it fetches several and pays for the site's nav, footer, cookie banner, promo rail and legal boilerplate once per fetch. Per-fetch yield is already the binding constraint for these clients. Measured crawler traffic shows roughly a third of AI-crawler fetches landing on 404s, an order of magnitude worse than Googlebot. A site whose useful payload is a thin slice of each response multiplies an existing efficiency problem. The falsifiable claim: repeated shingles are mechanically identifiable across a sample, and the tokens they occupy are, by construction, information the agent already has after the first fetch. This check is also what makes the llms-full.txt / markdown-alternate recommendation quantitative rather than fashionable — it prices what the alternate would save.

## Evidence

- **[The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler)** — Vercel (study, URL verified 2026-08-20)
  - "none of the major AI crawlers currently render JavaScript" — explicitly GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot — though they do fetch JS files as text (ChatGPT 11.50%, Claude 23.84% of requests). ChatGPT spends 34.82% and Claude 34.16% of fetches on 404s vs Googlebot's 8.22%. Establishes that (a) what an AI crawler ingests is the raw HTML byte stream with no CSS/JS applied, and (b) per-fetch yield is already terrible, so wasted tokens per fetch compound.
- **[The /llms.txt file](https://llmstxt.org/)** — Answer.AI (Jeremy Howard) (draft-spec, URL verified 2026-08-20)
  - Defines llms.txt at /llms.txt (or any subpath) in Markdown, with H1 title, optional blockquote summary and H2-delimited link sections. Recommends clean Markdown mirrors 'at the same URL as the original page, either with .md appended (page.html.md) or with the extension replaced by .md (page.md)', and uses type="text/markdown" in link relations. CRITICALLY: the spec states no requirement for the file's own HTTP Content-Type, no CORS guidance and no caching guidance — so any content-type audit is enforcing convention, not spec.
- **[Trafilatura — evaluation of web content extractors](https://trafilatura.readthedocs.io/en/latest/evaluation.html)** — Adrien Barbaresi / trafilatura docs (study, URL verified 2026-08-20)
  - Benchmark over 990 documents (run dated 2026-08-04): trafilatura 2.2.0 F=0.924 (P 0.906 / R 0.943), magic-html F=0.889, news-please F=0.836, readability-lxml F=0.826, goose3 F=0.810 with precision 0.936 but recall 0.714, inscriptis recall 0.991 with precision 0.534. Extractors disagree massively on what the main content of a page is — quantified spread that justifies an extractor-agreement metric.
- **[openai/tiktoken](https://github.com/openai/tiktoken)** — OpenAI (repo, URL verified 2026-08-20)
  - Fast BPE tokenizer with cl100k_base and o200k_base encodings and encoding_for_model(); counts tokens fully offline, 3-6x faster than comparable tokenizers. Makes every token metric in this domain deterministic, reproducible and CI-friendly with no network or model call.
- **[Web Almanac 2024 — Markup](https://almanac.httparchive.org/en/2024/markup)** — HTTP Archive (dataset, URL verified 2026-08-20)
  - The median mobile page carries 594 elements, and the 90th percentile 1,716. Median HTML transfer size is 33 kB on desktop and 32 kB on mobile, and 10.5% of mobile pages serve HTML uncompressed. 86% of mobile pages contain at least one HTML comment, and 26% still ship IE conditional comments. SVG is present on 51.6% of pages. Population baseline for calibrating per-page token budgets and for the claim that dead markup ships at scale.
- **[OpenAI Bots / Crawler documentation](https://developers.openai.com/api/docs/bots)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Four distinct user agents, with separate robots.txt tokens and separate published IP-range files. OAI-SearchBot surfaces sites in ChatGPT search — https://openai.com/searchbot.json. OAI-AdsBot validates ad landing pages — https://openai.com/adsbot.json. GPTBot handles model training — https://openai.com/gptbot.json, ChatGPT-User (user-initiated actions: web visits and GPT Actions — https://openai.com/chatgpt-user.json). ChatGPT-User is the agent that fetches on a shopper's behalf. Crucially these are separately controllable: blocking GPTBot does not block OAI-SearchBot or ChatGPT-User, and vice versa.

## Example failure

A documentation site renders a 4,100-token sidebar containing every page in the tree into all 600 pages. Delivered 5,200 tokens per page, unique 1,100 — 79% boilerplate. An agent reading eight pages spends 41,600 tokens to obtain 8,800 tokens of documentation, and the repeated sidebar dominates the context it reasons over.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Implementation deviations

- The sample is the scan's existing crawl. The audit fetches nothing.
- Stratification is by URL path depth, capped at 5 pages per depth. The proposal asked for template detection. Depth is a cheap, stable stand-in that keeps one large template from defining boilerplate for the whole site.
- Per-page unique tokens are the extracted-content tokens scaled by the share of five-word windows that are not site-wide boilerplate. Counting tokens per shingle would double-count overlapping words.
- The 35% warn band is this implementation's. The fail thresholds (20% distinct, or a median below 300 distinct tokens) are the proposal's.
- Fewer than 3 pages with extractable content returns `notApplicable`.

## Deferred

- A dollar figure at a user-supplied per-million rate. `ScanOptions` carries no such rate.
- Template detection by structural fingerprint.
- Cross-run trending. The scanner reports one run.
