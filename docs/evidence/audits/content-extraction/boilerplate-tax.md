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

Site-level rather than page-level: sample 10-30 URLs across templates, identify shingles present on ≥80% of sampled pages (the repeated chrome), and report boilerplate token share, unique tokens per fetch, and total tokens an agent must spend to acquire the site's distinct information. Fail if unique content is < 20% of tokens fetched, or if median unique tokens per page < 300 (thin pages that force many fetches for little yield). Emit a cost line in tokens and, optionally, dollars at a user-supplied per-million rate.

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
  - Four distinct user agents with separate robots.txt tokens and separate published IP-range files: OAI-SearchBot (surfaces sites in ChatGPT search — https://openai.com/searchbot.json), OAI-AdsBot (validates ad landing pages — https://openai.com/adsbot.json), GPTBot (model training — https://openai.com/gptbot.json), ChatGPT-User (user-initiated actions: web visits and GPT Actions — https://openai.com/chatgpt-user.json). ChatGPT-User is the agent that fetches on a shopper's behalf. Crucially these are separately controllable: blocking GPTBot does not block OAI-SearchBot or ChatGPT-User, and vice versa.

## Competitor coverage

SEO crawlers ship near-duplicate-page detection (Screaming Frog and similar) aimed at thin-content and canonicalization problems; they measure page-to-page similarity, not the token mass of shared chrome, and they never express the result as agent context cost per fetch. Lighthouse is single-page by construction and cannot compute this at all. The 'unique tokens per fetch' framing appears nowhere.

## Implementation sketch

Reuse the existing multi-page crawl. For each sampled URL keep the extracted main content and the full delivered token count from the Signal Density check. Build a 5-gram shingle index across the sample; mark shingles with document frequency ≥ 0.8 as boilerplate. Per page: boilerplate tokens, unique tokens, ratio. Site roll-up: total delivered tokens, total unique tokens, unique-per-fetch median. Stratify the sample by URL path depth and by detected template so a large blog does not swamp the commerce templates. Present the headline as 'an agent reading 10 pages of this site pays N tokens to receive M tokens of distinct information'.

## Example failure

A documentation site renders a 4,100-token sidebar containing every page in the tree into all 600 pages. Delivered 5,200 tokens per page, unique 1,100 — 79% boilerplate. An agent reading eight pages spends 41,600 tokens to obtain 8,800 tokens of documentation, and the repeated sidebar dominates the context it reasons over.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

The shipped audit is `content-extraction/boilerplate-tax`: the proposal's
`token-economics` domain is a research grouping, not one of the eight v2
categories, and the proposal's slug —
`boilerplate-tax-across-the-crawl-unique-tokens-per-fetch` — produced a
73-character id, over the 64-character cap `v2-meta.test.ts` enforces. The full
name survives as the audit's title.

The sample is the scan's existing crawl, not a new one. No page is fetched for
this audit.

Stratification is by URL path depth, capped at 5 pages per depth. The proposal
asks for stratification by detected template; depth is a cheap stand-in that is
stable across runs and achieves the thing that matters — a site with a large
blog cannot let its blog chrome define what "boilerplate" means for the whole
site while the commerce templates go unmeasured.

Per-page unique tokens are the page's extracted-content tokens scaled by the
share of its five-word windows that are not site-wide boilerplate. Counting
tokens per shingle directly would double-count the four words every pair of
adjacent shingles shares.

Thresholds are the proposal's: below 20% of fetched tokens distinct, or a median
below 300 distinct tokens per page, fails. The 35% warn band between "failing"
and "fine" is this implementation's, not the proposal's.

Fewer than 3 pages with extractable content returns `notApplicable`. Document
frequency over two documents is arithmetic, not a measurement.

## Deferred

- **A dollar figure.** The proposal offers an optional cost line at a
  user-supplied per-million rate. `ScanOptions` carries no such rate, and
  inventing one would put a number in the report the operator never gave.
- **Template detection.** Grouping pages by their actual template needs a
  structural fingerprint per page; depth buckets do the same job for this
  measurement at a fraction of the cost.
- **Cross-run trending.** "Unique tokens per fetch" is most useful as a series.
  The scanner reports one run.
