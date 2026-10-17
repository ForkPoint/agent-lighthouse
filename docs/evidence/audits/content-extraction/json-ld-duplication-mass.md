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

## Example failure

A publisher emits Article with a full articleBody, an identical NewsArticle graph from a second plugin, plus a FAQPage repeating all six on-page Q&As. The 2,400-token article is delivered three times in one response — 7,200 tokens — and the model, seeing near-identical passages, has more surface for contradiction if any copy is stale.

## Scoring

Tier per evidence policy: **informative (weight 0)** — grade C does not meet the A/B bar required for scored audits.

## Implementation deviations

- The audit reports a cost and never fails. Duplication may be deliberate, and no documented consumer path shows it changing an answer.
- Duplicate nodes are found by canonicalizing each node (keys sorted, values rendered) and counting repeats. This catches two copies of one node with no `@id`.
- A bare reference (a node whose only key, apart from an inherited `@context`, is `@id`) is not a declaration and is not counted.
- Only prose properties are compared with the DOM: `articleBody`, `text`, `description`, `reviewBody`, `abstract`, `transcript`, matched by name at any depth. Overlap is reported from 50% up.
- Only the entry page is measured.

## Deferred

- Cross-page duplication of one `@graph`.
- A dollar figure. No per-million rate is supplied to the scanner.
