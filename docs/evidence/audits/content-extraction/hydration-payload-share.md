---
audit: content-extraction/hydration-payload-share
category: content-extraction
source_file: packages/core/src/audits/content-extraction/hydration-payload-share.ts
slug: hydration-payload-share
evidence_grade: A
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-22"
reviewed: 2026-08-20
graduated: 2026-08-22
---


# Inlined hydration-state payload share

> Shipped in v2. Evidence grade **A** · scored tier · unique · implementation: `static-fetch`

## What it checks

Detect and size serialized framework state inlined in the HTML document: <script id="__NEXT_DATA__">, self.__next_f.push( flight chunks, window.__NUXT__, __remixContext, window.__APOLLO_STATE__, window.__INITIAL_STATE__, <script type="application/json"> islands, and Astro/Svelte island props. Three independent failure conditions: (1) any single state payload > 128 kB, (2) total state payload > 30% of document tokens, (3) state payload duplicates > 50% of the main-content text (content shipped twice in one response).

## Claimed mechanism (falsifiable)

These blobs are inlined into every HTML response by design, and the framework vendor itself flags > 128 kB as a defect. A browser parses them and throws them away after hydration; a non-rendering AI crawler cannot — it tokenizes the JSON verbatim, including escaped HTML, CDN image variants, GraphQL type metadata and the full body text a second time. The causal claim is falsifiable per page: strip these script nodes, re-tokenize, and the delta is the exact context cost that carries zero incremental information, since duplicate #3 is byte-identical content the agent already has.

## Evidence

- **[Large Page Data (Next.js error reference)](https://nextjs.org/docs/messages/large-page-data)** — Vercel / Next.js (vendor-doc, URL verified 2026-08-20)
  - Warns when a page ships > 128 kB of serialized __NEXT_DATA__ JSON; states "The serialized data is inlined in every HTML response, increasing the document size"; threshold configurable via experimental.largePageDataBytes. Gives a vendor-sanctioned hard numeric threshold for inlined hydration state in the HTML document.
- **[The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler)** — Vercel (study, URL verified 2026-08-20)
  - "none of the major AI crawlers currently render JavaScript" — explicitly GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot — though they do fetch JS files as text (ChatGPT 11.50%, Claude 23.84% of requests). ChatGPT spends 34.82% and Claude 34.16% of fetches on 404s vs Googlebot's 8.22%. Establishes that (a) what an AI crawler ingests is the raw HTML byte stream with no CSS/JS applied, and (b) per-fetch yield is already terrible, so wasted tokens per fetch compound.
- **[openai/tiktoken](https://github.com/openai/tiktoken)** — OpenAI (repo, URL verified 2026-08-20)
  - Fast BPE tokenizer with cl100k_base and o200k_base encodings and encoding_for_model(); counts tokens fully offline, 3-6x faster than comparable tokenizers. Makes every token metric in this domain deterministic, reproducible and CI-friendly with no network or model call.
- **[Large Language Models Can Be Easily Distracted by Irrelevant Context](https://arxiv.org/abs/2302.00093)** — Shi et al., ICML 2023 (arXiv 2302.00093) (study, URL verified 2026-08-20)
  - Introduces GSM-IC; finds "the model performance is dramatically decreased when irrelevant information is included" in the prompt, mitigated only partially by self-consistency and explicit ignore-instructions. Grounds the claim that boilerplate/duplicate/hidden text in an ingested page degrades answer quality, not just cost.
- **[Web Almanac 2024 — Page Weight](https://almanac.httparchive.org/en/2024/page-weight)** — HTTP Archive (dataset, URL verified 2026-08-20)
  - Median total page 2,652 kB desktop / 2,311 kB mobile; p90 8,375 kB / 7,680 kB; median desktop homepage loads ~18 kB of HTML against ~1,054 kB images and ~613 kB JS. Useful contrast: for a rendering browser HTML is ~1% of weight, but for a non-rendering AI crawler that HTML document is ~100% of what gets tokenized — so HTML-internal waste is the entire agent-side cost.

## Competitor coverage

Lighthouse performance flags 'unused JavaScript' and total byte weight but has no notion of inlined serialized state, and its Agentic Browsing category does not touch payload composition. SEO crawlers ignore script content entirely except for JSON-LD. No AI-readiness tool inspects __NEXT_DATA__/flight payloads.

## Implementation sketch

Static fetch, parse with cheerio. Select script nodes by id/type and by regex on the source for the known globals; for RSC flight, concatenate all self.__next_f.push( argument strings. Byte-size each payload (compare against 128,000 to reuse the vendor threshold verbatim) and tokenize each at o200k_base. For the duplication condition, unescape the JSON string values, normalize whitespace, shingle at 5-grams, and compute the fraction of main-content shingles that also appear inside the state payload. Report per-payload so the fix is targeted ('__NEXT_DATA__ carries the full 6,200-token article body already present in <article>').

## Example failure

A Pages-Router e-commerce category page ships a 410 kB __NEXT_DATA__ containing every product's full description, all image CDN variants and the whole nav tree. Tokenized: ~118k tokens of JSON against ~1.4k tokens of visible content, and the top 3 product descriptions appear twice in the agent's context — cost 80x, information gain zero.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

- **No tokenizer.** The dossier sizes payloads at `o200k_base`; the shipped
  audit uses the repo-wide estimator `characters / 4` (`CHARS_PER_TOKEN = 4`),
  because the global constraint forbids new runtime dependencies. Counts are
  labelled `est. tokens` wherever they surface. The 128 kB single-payload
  ceiling is unaffected: it is a byte threshold, taken verbatim from the vendor.
- **Share is measured in characters, not tokens.** Serialized-state characters
  over document characters. For a fixed estimator the two ratios are the same
  number, so the 30% ceiling keeps its meaning.
- **RSC flight frames are summed by script body, not by parsed argument.**
  Every `<script>` containing `self.__next_f.push(` contributes its whole body
  to one payload. The wrapper adds a constant few dozen bytes per frame and
  removes a fragile argument-boundary parse.
- **Duplication reads JSON string literals only**, unescaped and stripped of
  markup, then compares 5-gram shingles against `getMainContentText`. Keys and
  type metadata are excluded, so the reported fraction is about prose shipped
  twice rather than about JSON shape.

## Deferred

- Per-payload duplication attribution (which payload repeats the body) is
  reported at the aggregate level; the per-payload breakdown needs the state
  parsed into a tree rather than scanned for literals.
- Svelte island props are matched through the `__sveltekit_*` assignment; the
  `<astro-island props>` attribute form is sized directly.
