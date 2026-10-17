---
audit: answer-readiness/section-split-risk-profile
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/section-split-risk-profile.ts
slug: section-split-risk-profile
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - azure-search-chunk-documents
  - langchain-html-splitters
---

# Section Split-Risk Profile

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `static-fetch`

## What it checks

Measures every h2 and h3 section against the published default chunk window of 512 tokens, or about 2000 characters. It finds sections that will be mechanically cut into two or more chunks, producing tail chunks that carry no heading. It also finds the inverse: sections too thin to embed meaningfully. Also flags atomic structures (tables, long ordered lists) longer than the window, which get split mid-structure.

## Claimed mechanism (falsifiable)

Fixed-window splitters cut at a character/token budget, not at meaning. When a section exceeds the window, chunk 1 keeps the heading (the strongest query-matching signal on the page) and every subsequent chunk from that section is headless — its embedding loses the topical anchor. Azure publishes 512 tokens / 2000 chars with 25% overlap as the recommended default and lists heading-based segmentation as an alternative that avoids this. Falsifiable prediction: for a page with one 2,000-token section versus the same content split into four 500-token h2 sections, the queries that match content in the final quarter of the text retrieve the split version and miss the monolithic one.

## Evidence

- **[Chunk Documents - Azure AI Search](https://learn.microsoft.com/en-us/azure/search/vector-search-how-to-chunk-documents)** — Microsoft (vendor-doc, verified 2026-10-17)
  - Recommends "starting with a chunk size of 512 tokens (approximately 2,000 characters) and an initial overlap of 25%". This is the window the audit measures against.
  - Its default Text Split parameters cut pages of 2,000 characters with a 500-character overlap.
  - It names heading syntax in HTML or Markdown as a way to chunk by section. It also suggests appending the document title to mid-document chunks "to prevent context loss", which is the loss a headless tail chunk suffers.
- **[Split HTML — LangChain text splitter integrations](https://docs.langchain.com/oss/python/integrations/splitters/split_html)** — LangChain (vendor-doc, URL verified 2026-08-20)
  - `HTMLHeaderTextSplitter` splits on `<h1>`, `<h2>`, `<h3>` and attaches the headers relevant to each chunk as metadata. A section with headings carries them into its chunks. A page without them gives the splitter nothing to cut on.

**Grade: B** — Microsoft documents the 512-token default for its own retrieval pipeline, and LangChain documents heading-based splitting. Neither measures the retrieval loss from a headless tail chunk, and other pipelines use other windows. A documented default with no measured effect is a grade-B mechanism.

## Example failure

A 3,100-token 'Frequently asked questions' h2 with 22 questions as bold paragraphs rather than h3 headings. Split at 512 tokens it yields six chunks, five of which are headless bare Q&A text with no page or topic anchor. Promoting each question to h3 converts the same content into 22 self-anchored chunks.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Implementation deviations

- Token counts are real `o200k_base` counts from `gpt-tokenizer`, never `chars / 4`.
- `ATOMIC-SPLIT` covers `ul` as well as `table` and `ol`. An unordered list loses its preamble the same way.
- The atomic serializer is a small GFM-shaped renderer written in place. It only needs a length.
- The score is the share of section tokens in sections at or under the window. A `BLOB` page scores 0, because none of its text sits in a headed chunk.
- Below 70% fails. Below 90%, or any `SPLIT`, `ATOMIC-SPLIT` or `BLOB` finding, warns. Both bands are this implementation's own.
- `THIN` is reported in `found` and `details.findings` but never sets the status. A section under the window is never cut.
- A page under 512 tokens is `notApplicable`. A retriever never cuts it.

## Deferred

- Per-page assessment. Only `ctx.pages[0]` is profiled.
- Overlap-aware scoring. It needs pipeline parameters a scanner does not have.
