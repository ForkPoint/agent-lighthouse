---
audit: content-extraction/preamble-tax
category: content-extraction
source_file: packages/core/src/audits/content-extraction/preamble-tax.ts
slug: preamble-tax
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - lost-in-the-middle-arxiv
  - vercel-rise-of-ai-crawler
  - s18
  - openai-searchbot-ips
  - tiktoken
  - readability-repo
---

# Preamble Tax (tokens before the first content token)

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `static-fetch`

## What it checks

Measure the token offset, within the raw response body, at which the main content actually begins — i.e. how many tokens an agent must stream past before the first sentence of the answer appears. Pass < 2,000 tokens; warn 2,000-10,000; fail > 10,000. Also report the offset as a fraction of total document tokens and whether the content is split across a mid-document scripts/state island.

## Claimed mechanism (falsifiable)

Non-rendering agents ingest the document as a linear byte stream, so DOM order equals context order. Model accuracy is position-sensitive: relevant information at the beginning or end of a context is retrieved far more reliably than information buried in the middle. A page that inlines a 40k-token critical-CSS block and a serialized state blob ahead of <main> therefore does two things at once. It pushes the answer into the low-recall middle of whatever context window it lands in. And it guarantees the answer is what gets cut when the fetching harness truncates to a byte or token cap. Falsifiable: locate the first 200 normalized characters of the extracted main content inside the raw body, count tokens before that byte offset, and the number is deterministic.

## Evidence

- **[Lost in the Middle: How Language Models Use Long Contexts](https://arxiv.org/abs/2307.03172)** — Liu et al. (arXiv 2307.03172) (study, URL verified 2026-08-20)
  - "performance is often highest when relevant information occurs at the beginning or end of the input context, and significantly degrades when models must access relevant information in the middle of long contexts", including for explicitly long-context models. Grounds position-sensitive checks: burying the answer behind kilotokens of preamble is not merely a cost problem, it measurably lowers retrieval accuracy.
- **[The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler)** — Vercel (study, URL verified 2026-08-20)
  - "none of the major AI crawlers currently render JavaScript" — explicitly GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot — though they do fetch JS files as text (ChatGPT 11.50%, Claude 23.84% of requests). ChatGPT spends 34.82% and Claude 34.16% of fetches on 404s vs Googlebot's 8.22%. Establishes that (a) what an AI crawler ingests is the raw HTML byte stream with no CSS/JS applied, and (b) per-fetch yield is already terrible, so wasted tokens per fetch compound.
- **[OpenAI Bots / Crawler documentation](https://developers.openai.com/api/docs/bots)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Four distinct user agents, with separate robots.txt tokens and separate published IP-range files. OAI-SearchBot surfaces sites in ChatGPT search — https://openai.com/searchbot.json. OAI-AdsBot validates ad landing pages — https://openai.com/adsbot.json. GPTBot handles model training — https://openai.com/gptbot.json, ChatGPT-User (user-initiated actions: web visits and GPT Actions — https://openai.com/chatgpt-user.json). ChatGPT-User is the agent that fetches on a shopper's behalf. Crucially these are separately controllable: blocking GPTBot does not block OAI-SearchBot or ChatGPT-User, and vice versa.
- **[openai/tiktoken](https://github.com/openai/tiktoken)** — OpenAI (repo, URL verified 2026-08-20)
  - Fast BPE tokenizer with cl100k_base and o200k_base encodings and encoding_for_model(); counts tokens fully offline, 3-6x faster than comparable tokenizers. Makes every token metric in this domain deterministic, reproducible and CI-friendly with no network or model call.
- **[mozilla/readability](https://github.com/mozilla/readability)** — Mozilla (repo, URL verified 2026-08-20)
  - parse() returns title, content, textContent, length, excerpt, byline, dir, siteName, lang, publishedTime; charThreshold default 500 chars below which no article is returned; isProbablyReaderable uses minContentLength 140 and minScore 20. Gives concrete pass/fail hooks (null result, length, title) for an extractability check.

## Example failure

A news article inlines critical CSS plus an ad-stack config object plus a consent-vendor list in <head>, then renders a nav mega-menu, before the first paragraph appears at token 34,000 of a 41,000-token document. A harness that truncates the fetch at 32k tokens gives the model a page with zero article text; the model answers from the nav labels and the site gets misquoted.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Implementation deviations

- The offset is found by projecting the raw body onto its visible characters, keeping each character's byte offset, and locating the first 200 characters of the extracted content there.
- Whitespace is removed from both sides, not collapsed. Extractors disagree about whether a tag boundary separates words.
- Content that cannot be located returns `notApplicable`. The sketch's position-tracking parser fallback was not built, because a guessed offset would invent the finding.
- Fewer than 200 characters of extractable content returns `notApplicable`. Readability often returns a nav-sized stub.
- The offset is also reported as a share of the whole document.
- The largest opaque block ahead of the content (`<script>`, `<style>`, `<template>`, `<svg>`, `<noscript>` or a comment) is named with its token cost and line number.

## Deferred

- Mid-document content islands. Content interrupted later by a state blob belongs in its own check.
- Per-page sampling. Only the entry page is measured.
