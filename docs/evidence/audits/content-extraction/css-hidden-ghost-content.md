---
audit: content-extraction/css-hidden-ghost-content
category: content-extraction
source_file: packages/core/src/audits/content-extraction/css-hidden-ghost-content.ts
slug: css-hidden-ghost-content
evidence_grade: A
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-22"
reviewed: 2026-08-20
graduated: 2026-08-22
sources:
  - readability-src
  - vercel-rise-of-ai-crawler
  - distracted-irrelevant
  - google-sd-policy
  - readability-repo
---

# Ghost content: CSS-hidden text ingested as visible

> Shipped in v2. Evidence grade **A** · scored tier · unique · implementation: `static-fetch`

## What it checks

Find text that is hidden from human readers by an external stylesheet class but is invisible-as-hidden to every extractor an agent uses, and size it in tokens. Fail if class-hidden text exceeds 15% of the page's total text tokens or 1,000 tokens absolute; separately fail on near-duplicate hidden blocks (a mobile nav or tab-panel set duplicating visible content). Report contradiction risk when hidden text contains prices, availability, or dated claims.

## Claimed mechanism (falsifiable)

This is provable from source, not inferred. Readability's visibility test consults only node.style.display, node.style.visibility, the hidden attribute and aria-hidden — it explicitly does not evaluate class-based CSS rules from stylesheets. AI crawlers do not render, so no cascade is ever computed. Therefore any subtree hidden by `.mobile-only{display:none}`, `.tab-panel:not(.active){display:none}` or `[data-state=closed]{display:none}` reaches the model as ordinary body text with full weight. Consequence is not just cost: the agent sees three parallel copies of a nav, both the collapsed and expanded FAQ answers, and often stale price text from a hidden variant block, and irrelevant/contradictory context measurably degrades answers.

## Evidence

- **[Readability.js source — \_isProbablyVisible](https://raw.githubusercontent.com/mozilla/readability/main/Readability.js)** — Mozilla (repo, URL verified 2026-08-20)
  - Visibility test is literally: node.style.display != "none" && node.style.visibility != "hidden" && !node.hasAttribute("hidden") && aria-hidden!="true". Only inline styles and attributes are consulted — "It does not evaluate class-based CSS rules from stylesheets." Proof that content hidden by an external stylesheet class is ingested as if visible by the most widely deployed extractor.
- **[The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler)** — Vercel (study, URL verified 2026-08-20)
  - "none of the major AI crawlers currently render JavaScript" — explicitly GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot — though they do fetch JS files as text (ChatGPT 11.50%, Claude 23.84% of requests). ChatGPT spends 34.82% and Claude 34.16% of fetches on 404s vs Googlebot's 8.22%. Establishes that (a) what an AI crawler ingests is the raw HTML byte stream with no CSS/JS applied, and (b) per-fetch yield is already terrible, so wasted tokens per fetch compound.
- **[Large Language Models Can Be Easily Distracted by Irrelevant Context](https://arxiv.org/abs/2302.00093)** — Shi et al., ICML 2023 (arXiv 2302.00093) (study, URL verified 2026-08-20)
  - Introduces GSM-IC; finds "the model performance is dramatically decreased when irrelevant information is included" in the prompt, mitigated only partially by self-consistency and explicit ignore-instructions. Grounds the claim that boilerplate/duplicate/hidden text in an ingested page degrades answer quality, not just cost.
- **[Structured data general guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)** — Google (vendor-doc, URL verified 2026-08-20)
  - "Don't mark up content that is not visible to readers of the page"; "Your structured data must be a true representation of the page content"; hidden content is listed as a reason rich results fail. Constrains the JSON-LD bloat check: the fix is never "delete schema", it is "stop shipping the entire body twice".
- **[mozilla/readability](https://github.com/mozilla/readability)** — Mozilla (repo, URL verified 2026-08-20)
  - parse() returns title, content, textContent, length, excerpt, byline, dir, siteName, lang, publishedTime; charThreshold default 500 chars below which no article is returned; isProbablyReaderable uses minContentLength 140 and minScore 20. Gives concrete pass/fail hooks (null result, length, title) for an extractability check.

## Example failure

A SaaS pricing page ships desktop nav, mobile nav and a hidden search-overlay menu. It also ships all four collapsed FAQ answers, and a `.legacy-pricing` block kept in the DOM behind display:none. 3,900 of the page's 5,600 text tokens are never seen by a human. An agent asked 'how much is the Pro plan' reads the legacy $29 from the hidden block alongside the live $49, and reports the wrong price with confidence.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Implementation deviations

- No `postcss`, `linkedom` or `css-select`. Stylesheets are read by the local `gatherers/css-rules.ts` scanner, and selectors are matched with cheerio.
- No tokenizer. Token counts are `characters / 4`, labelled `est. tokens`.
- No specificity and no media-query evaluation. Rules inside `@media print` are ignored. Declaration-only at-rules (`@font-face`, `@keyframes`, `@page`) are skipped. The matched selector is reported so a human can adjudicate.
- `display` is resolved per selector. Within a block the last declaration wins. A later rule for the identical selector in the same at-rule context overrides an earlier one, and `!important` outranks a plain declaration.
- Different selectors are never ranked. `.panel{display:none}` stays counted even when `.panel.open{display:block}` exists. A media-query override does not cancel a base rule.
- Inline `<style>` blocks and linked same-origin sheets keep document order. At most five sheets are read.
- Cross-origin stylesheets are never fetched. Their count is appended to the `found` string.
- Elements with an inline hidden marker (`hidden`, `aria-hidden="true"`, a resolved inline `display:none` or `visibility:hidden`) are excluded. Readability already drops them. Inline styles use the same resolver as `dom-visibility.ts`.
- Nested matches count once, through the outermost hidden element.
- Contradiction risk (prices, availability, dated claims in hidden text) is reported as a signal, not adjudicated against the visible copy.

## Deferred

- Exact resolution through `getComputedStyle` in a headless browser. It would replace the scanner.
- Specificity between different selectors, such as `.box p` against `.box p:first-of-type`.
- `operability-safety/invisible-instruction-scan` still matches `display:none` anywhere in a block.
