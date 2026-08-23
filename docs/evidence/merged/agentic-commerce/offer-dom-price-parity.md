---
check: offer-dom-price-parity
title: "offer-dom-price-parity"
domain: competitor-gap-verify
status: proposed
evidence_grade: B
uniqueness: unique
difficulty: multi-page
scoring_tier: scored
reviewed: 2026-08-20
---

# offer-dom-price-parity

> Proposed check. Evidence grade **B** · unique · implementation: `multi-page`

## What it checks

Cross-artifact reconciliation of machine-readable commerce claims against what the raw HTML actually says, for shopping agents. On pages carrying JSON-LD or microdata `@type: Product`/`Offer`, extract offers.price, priceCurrency, availability, priceValidUntil, sku/gtin. Then extract candidate values from the RAW (unrendered) HTML main-content region: prices via a currency-anchored regex built from the declared priceCurrency (symbol and ISO code, tolerant of thousand separators and non-breaking spaces), and availability via phrase matching ('in stock', 'out of stock', 'sold out', 'pre-order', 'backorder', 'discontinued'). Failure classes. (a) PRICE-DISAGREEMENT, critical: at least one price is present in raw HTML and none equals the JSON-LD price after numeric normalisation. (b) AVAILABILITY-DISAGREEMENT, critical: availability is schema:InStock while the main-content region contains an out-of-stock phrase, or vice versa. (c) STALE-OFFER, high: priceValidUntil is in the past. (d) AMBIGUOUS-OFFER, high: two or more Offer nodes carry different price values for the same sku with no AggregateOffer wrapper — the agent has no rule for choosing. (e) UNMACHINE-READABLE, high: a price is visible in raw HTML but no Offer.price exists. (f) JS-ONLY-PRICE, warn not fail: neither the raw HTML nor the JSON-LD contains any price, meaning the number is injected client-side — reported separately because no major AI crawler executes JavaScript.

## Claimed mechanism (falsifiable)

Shopping agents read the structured offer, not the pixels, and no major AI crawler runs JS. Causal chain: if Offer.price is stale or contradicts the page, the agent quotes a price the checkout will reject, and the transaction fails after the user has committed — the most expensive possible failure mode in agentic commerce. Google's own structured data guidelines state verbatim 'Your structured data must be a true representation of the page content' and 'Don't mark up content that is not visible to readers of the page', so the disagreement is a documented policy violation as well as an agent failure. Falsifiable per page: the JSON-LD price either appears among the raw-HTML price candidates or it does not.

## Evidence

- **[Google Search — Structured data general guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)** — Google (vendor-doc, URL verified 2026-08-20)
  - Verbatim: 'Don't mark up content that is not visible to readers of the page.' and 'Your structured data must be a true representation of the page content.' This is the documented-consumer-behaviour basis for auditing markup↔DOM value agreement rather than markup syntax.
- **[The rise of the AI crawler (Vercel / Merj log study)](https://vercel.com/blog/the-rise-of-the-ai-crawler)** — Vercel (study, URL verified 2026-08-20)
  - None of GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot, Meta, ByteDance or Perplexity crawlers execute JavaScript; Gemini rides Googlebot infra (renders) and AppleBot renders. ChatGPT spends 11.50% of requests on JS files, Claude 23.84% — fetched as text, never executed. Crawl waste: ChatGPT 34.82% of fetches hit 404s and 14.36% follow redirects; Claude 34.16% hit 404s; Googlebot only 8.22%/1.49%.
- **[Agentic Commerce Protocol — Product Feed Spec](https://agentic-commerce-protocol.com/docs/commerce/specs/feed)** — OpenAI + Stripe (spec, URL verified 2026-08-20)
  - Three specs: Agentic Checkout, Product Feed, Delegated Payment (Apache 2.0). Feed required fields include seller_name, seller_url, seller_privacy_policy, seller_tos (last two required if checkout enabled), shipping as country:region:service_class:price. Recommended: offer_id, color, size, size_system, gender. Formats TSV/CSV/XML/JSON. Feeds are PUSHED to OpenAI at an agreed endpoint (not published at a public well-known URL), refresh every 15 min — so no external audit can fetch a merchant's ACP feed.
- **[seoClarity Clarity ArcAI suite](https://www.seoclarity.net/)** — seoClarity (vendor-doc, URL verified 2026-08-20)
  - 12 named modules: Track Visibility, Research Prompts, Analyze Sentiment, Optimize Content, Measure Performance, Discover Bot Activity (/ai-seo/ai-bot-activity-tracking — 'know if AI bots access your pages', log-based), Monitor Accuracy, MCP Server and API, Accelerate Indexation, Monitor Web Mentions, Track AI Shopping, Product Feed Optimizer. Bot Activity is observational, not a conformance audit.
- **[Semrush AI Visibility Toolkit](https://www.semrush.com/features/ai-visibility/)** — Semrush (vendor-doc, URL verified 2026-08-20)
  - Visibility Overview, Brand Performance, Competitor Research, Prompt Tracking, AI-Cited Media, Prompt Research. The page cross-sells the separate classic Site Audit for 'technical health' but documents no AI-bot-specific crawlability, llms.txt or agent-schema checks inside the AI toolkit.
- **[Lighthouse core/config/agentic-browsing-config.js (main branch)](https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/core/config/agentic-browsing-config.js)** — GoogleChrome/lighthouse (repo, URL verified 2026-08-20)
  - Complete shipped list of the Agentic Browsing category: exactly 6 auditRefs — agent-accessibility-tree, webmcp-form-coverage, webmcp-registered-tools, webmcp-schema-validity, cumulative-layout-shift, llms-txt. Two groups (webmcp, agent-accessibility). Category description says 'still under development and subject to change'. Copyright 2026 Google LLC.

## Competitor coverage

Nobody. Every schema validator in the market — Google Rich Results Test, Schema.org validator, Semrush/Ahrefs/seoClarity schema modules, and our own structured-data audits — validates syntax and required-field presence, never value agreement between markup and rendered text. Lighthouse's structured-data-related audits are manual/informative and do no value comparison. seoClarity's Product Feed Optimizer works on the merchant's outbound feed, not the page. ACP feeds are pushed privately to OpenAI on an agreed endpoint every 15 minutes and are never published at a public URL, so the page's JSON-LD is the only externally auditable commerce artifact that exists.

## Implementation sketch

Static per-page; reuses the JSON-LD parse our structured-data audits already perform and the raw HTML the fetcher already holds. New file packages/core/src/audits/structured-data/offer-dom-parity.ts, sitting alongside offer-schema.ts / product-details.ts / product-transaction-certainty.ts, which all check PRESENCE of fields and must be left alone — this audit checks AGREEMENT of values, an orthogonal axis. False-positive controls that matter: restrict extraction to the main product region (nearest common ancestor of the h1 and the first Offer-bearing node) so related-product carousels and 'was/now' strikethrough prices do not fire; accept a match against any candidate, not the first; treat a strikethrough/`<del>`/`.was-price` value as an acceptable non-match; and demote to warn rather than fail when raw HTML has no price at all, since that is case (f), a different finding. Grade B rather than A: the mechanism is documented Google policy plus documented non-rendering crawlers, but no AI vendor has published 'we reject offers whose markup disagrees with the DOM'.

## Example failure

A DTC store runs a flash sale. The template renders the sale price server-side into the visible HTML but the JSON-LD block is populated from a cached catalogue service and still carries the pre-sale price with a priceValidUntil from last quarter. The Rich Results Test passes (all required fields present, syntactically valid), Semrush and Ahrefs schema audits pass, our own offer-schema audit passes — and a shopping agent quotes the wrong price, then fails at checkout. The same template bug in reverse (JSON-LD says InStock, page says Sold Out) makes an agent recommend a product that cannot be bought.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
