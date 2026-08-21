---
check: extractor-survival-recall
title: "Extractor Survival Recall"
domain: answer-selection-forensics
status: proposed
evidence_grade: B
uniqueness: unique
difficulty: static-fetch
scoring_tier: scored
reviewed: 2026-08-20
---

# Extractor Survival Recall

> Proposed check. Evidence grade **B** · unique · implementation: `static-fetch`

## What it checks

Runs the boilerplate-stripping, HTML-to-markdown pipeline that agent readers actually run, then measures what fraction of the page's load-bearing spans survived it. Reports, by name, every key span that was dropped and the container that swallowed it. Also reports the extracted/total text ratio in both directions: over-stripping (answers living in stripped containers) and under-stripping (nav and footer boilerplate diluting the page's embedding).

## Claimed mechanism (falsifiable)

Answer engines and agent readers do not embed raw HTML; they strip boilerplate and convert main content to markdown — Jina Reader states 'Boilerplate such as navigation, headers, footers, and ads is stripped, and the main content is converted to Markdown' (S10), and Firecrawl exposes the same only-main-content path (S11). These extractors use structural and class-name heuristics. Content placed in <aside>, <footer>, a role=complementary region, or a container whose class matches a stripper blocklist is deleted before embedding, so it can never be retrieved or cited regardless of its quality. Falsifiable and cheap to verify: fetch the same URL through r.jina.ai and check whether the fact is present in the returned markdown.

## Evidence

- **[Lighthouse audit source: agent-accessibility-tree.js](https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/core/audits/agentic/agent-accessibility-tree.js)** — Google Chrome / Lighthouse (repo, URL verified 2026-08-20)
  - Implementation is a filter over artifacts.Accessibility.violations against ~37 TARGET_RULES from axe (button-name, link-name, input-button-name, label, autocomplete-valid, aria-allowed-attr, aria-required-attr, aria-valid-attr-value, tabindex, table/definition-list rules). Binary score: any violation scores 0. Crucially it inherits axe's blind spots — axe cannot fail an element that has no interactive semantics at all, and autocomplete-valid only validates tokens that are already present, never their absence.
- **[WebSuite: Systematically Evaluating Why Web Agents Fail](https://arxiv.org/html/2406.01623v1)** — arXiv (study, URL verified 2026-08-20)
  - Per-UI-primitive success rates for natbot and SeeAct. Worst patterns: slider interaction 0% for both agents; tooltip-based information retrieval 0% for both; complex form filling 12.5% (natbot) / 0% (SeeAct). Aggregate: operational actions 85.2%/76.2%, menu navigation 93.8%/81.3%, informational actions 43.8%/40.6%. Taxonomy covers click (button, link, icon button, slider, switch, accordion, dropdown menu, dialog button, snackbar), type (text/date/phone), select (checkbox, multicheck, select, datagrid row).

## Competitor coverage

No competitor runs the extraction pipeline and measures recall against the source. Lighthouse SEO checks that content is crawlable, not that it survives boilerplate stripping. This check is the difference between 'the bot can fetch it' (universally covered) and 'the bot keeps it' (covered by nobody). Content-to-code-ratio metrics in legacy SEO tools are a crude, non-span-level cousin.

## Implementation sketch

Static fetch, parse with linkedom or jsdom. 1) Run @mozilla/readability to get article.content. 2) Run a second pass mimicking Firecrawl/Jina defaults: drop script, style, nav, aside, header, footer, form, iframe, plus elements whose class or id matches /comment|sidebar|promo|related|advert|ad-|banner|cookie|newsletter|share/i. 3) Define key spans K: h1 text; the first two sentences of each h2/h3 section; every <caption>; every <dt>; every <th>; and every JSON-LD string value (description, offers.price, aggregateRating.ratingValue) that also literally occurs in the HTML. 4) recall = |K present in extracted output| / |K|; fail below 0.9. 5) For each dropped span, walk back up the source DOM and report the ancestor chain that caused the drop — that is the actionable output ('your spec table lives inside <aside class="related-specs">'). 6) textRatio = extracted chars / total visible-text chars: flag < 0.25 as over-strip risk and > 0.85 as boilerplate leakage (chrome text will dominate the page's chunk embeddings). 7) Report both extractors separately, since disagreement between them is itself a fragility signal.

## Example failure

A product page renders its full specification table inside <aside class="product-sidebar">. Readability and every only-main-content extractor drop the aside wholesale. The markdown an answer engine ingests contains marketing prose and no dimensions, weight, or materials — so the page can never be cited for the spec questions it is uniquely qualified to answer, while a retailer's thinner page that keeps specs in <main> wins the citation.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
