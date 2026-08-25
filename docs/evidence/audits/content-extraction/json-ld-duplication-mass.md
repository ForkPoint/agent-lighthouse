---
audit: content-extraction/json-ld-duplication-mass
category: content-extraction
source_file: packages/core/src/audits/content-extraction/json-ld-duplication-mass.ts
slug: json-ld-duplication-mass
evidence_grade: C
tier: informative
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - schemaorg-articlebody
  - google-sd-policy
  - tiktoken
  - distracted-irrelevant
  - cf-tomarkdown-rest
---


# JSON-LD duplication mass

> Shipped in v2. Evidence grade **C** · informative tier · unique · implementation: `static-fetch`

## What it checks

Measure the token cost of structured data and how much of it is a verbatim second copy of content already in the DOM. Report three numbers. First, JSON-LD token share of the document. Second, body-duplication ratio: the fraction of main-content shingles that also appear inside ld+json, driven mostly by articleBody, description and FAQPage acceptedAnswer. Third, redundant-graph count: the same @type and @id entity emitted by multiple script blocks, which is the classic WordPress plugin-stack signature. Flags at > 20% token share, > 0.8 body duplication, or ≥ 2 identical entity graphs. Report-only — never scored, and never phrased as 'remove your schema'.

## Claimed mechanism (falsifiable)

Structured data must mirror visible page content by policy, so some duplication is mandatory and correct. The defect is unbounded duplication. articleBody is a defined Text property, in use on 1M-10M domains. Populated with a full article, it ships the entire body a second time inside a script tag. Plugin stacks routinely emit the same Organization and WebSite graph three times. A non-rendering agent tokenizes all of it. The cost claim is arithmetic and verifiable. What stops this from being scoreable is that no vendor documents a consumer that penalizes it. The correct remediation is also a judgement call rather than a rule: drop articleBody, dedupe graphs into one @graph, and keep every required property.

## Evidence

- **[schema.org/articleBody](https://schema.org/articleBody)** — Schema.org (spec, URL verified 2026-08-20)
  - articleBody: "The actual body of the article", expected type Text, used on Article; reported in use across 1M-10M domains. Confirms the specific property that, when populated, duplicates the entire visible article inside a <script type="application/ld+json"> block.
- **[Structured data general guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)** — Google (vendor-doc, URL verified 2026-08-20)
  - "Don't mark up content that is not visible to readers of the page"; "Your structured data must be a true representation of the page content"; hidden content is listed as a reason rich results fail. Constrains the JSON-LD bloat check: the fix is never "delete schema", it is "stop shipping the entire body twice".
- **[openai/tiktoken](https://github.com/openai/tiktoken)** — OpenAI (repo, URL verified 2026-08-20)
  - Fast BPE tokenizer with cl100k_base and o200k_base encodings and encoding_for_model(); counts tokens fully offline, 3-6x faster than comparable tokenizers. Makes every token metric in this domain deterministic, reproducible and CI-friendly with no network or model call.
- **[Large Language Models Can Be Easily Distracted by Irrelevant Context](https://arxiv.org/abs/2302.00093)** — Shi et al., ICML 2023 (arXiv 2302.00093) (study, URL verified 2026-08-20)
  - Introduces GSM-IC; finds "the model performance is dramatically decreased when irrelevant information is included" in the prompt, mitigated only partially by self-consistency and explicit ignore-instructions. Grounds the claim that boilerplate/duplicate/hidden text in an ingested page degrades answer quality, not just cost.
- **[Markdown Conversion — REST API usage (Workers AI)](https://developers.cloudflare.com/workers-ai/features/markdown-conversion/usage/rest-api/)** — Cloudflare (vendor-doc, URL verified 2026-08-20)
  - The toMarkdown REST response returns fields id, name, mimeType, format, tokens, data — e.g. "tokens": 49 for a converted HTML file. A major infra vendor bills/reports HTML→markdown conversion in tokens per document, so per-page token count is a first-class, vendor-visible unit.

## Competitor coverage

Every SEO tool validates JSON-LD syntax and required properties; Lighthouse's structured-data checks are validity-oriented. None of them treat schema as a token cost or detect duplicate graphs across script blocks. Because it is diagnostic rather than scored, it belongs in the report body as an explainer for a bad Signal Density number, not in the score.

## Implementation sketch

Collect all <script type="application/ld+json">, tokenize each raw block at o200k_base. Parse each; walk to collect (@type, @id) pairs and hash canonicalized JSON of each node to find cross-block duplicates. For body duplication, take string-valued properties over ~500 chars (articleBody, text, description, acceptedAnswer.text, reviewBody), strip HTML entities, 5-gram shingle, and intersect with main-content shingles. Present as 'X tokens of your Y-token page are structured data; Z of those repeat text already in the DOM'.

## Example failure

A publisher emits Article with a full articleBody, an identical NewsArticle graph from a second plugin, plus a FAQPage repeating all six on-page Q&As. The 2,400-token article is delivered three times in one response — 7,200 tokens — and the model, seeing near-identical passages, has more surface for contradiction if any copy is stale.

## Scoring

Tier per evidence policy: **informative (weight 0)** — grade C does not meet the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

The shipped audit is `content-extraction/json-ld-duplication-mass`: the
proposal's `token-economics` domain is a research grouping, not one of the eight
v2 categories.

Grade C ships at tier `informative`, weight 0, `scoreDisplayMode: 'informative'`,
per the meta law — grade C in the scored tier is unregistrable. The audit
reports a cost and never fails: duplication is a decision an operator may have
made deliberately, and no documented consumer path shows it changing an answer.

Duplicate nodes are found by canonicalizing each node — keys sorted, values
rendered — and counting repeats. The proposal asks for `(@type, @id)` pairs plus
a canonical hash; the canonical form alone catches both, including the common
case of two blocks that carry the same node with no `@id` at all.

Long prose strings are compared against the DOM's five-word windows, and only
the properties that carry prose are considered: `articleBody`, `text`,
`description`, `reviewBody`, `abstract`, `transcript`. `acceptedAnswer.text`
from the sketch is covered by `text`, since the walk matches on the property name
wherever it sits. Overlap is reported from 50% up; below that a shared sentence
is a quotation, not a second copy.

Only the entry page is measured. The block is a template property, and
tokenizing every page's JSON-LD to report one number is a cost with no extra
finding in it.

## Deferred

- **Cross-page duplication.** The same `@graph` repeated on 400 pages is a
  crawl-level cost, which `content-extraction/boilerplate-tax` measures from the
  other direction.
- **Microdata and RDFa.** The proposal is about JSON-LD blocks specifically, and
  the other two formats do not carry a separate token cost — their text is the
  DOM's text.
- **A dollar figure.** No per-million rate is supplied to the scanner, and
  inventing one would put a number in the report the operator never gave.
