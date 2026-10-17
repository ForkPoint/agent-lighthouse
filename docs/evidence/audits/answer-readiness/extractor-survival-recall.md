---
audit: answer-readiness/extractor-survival-recall
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/extractor-survival-recall.ts
slug: extractor-survival-recall
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - lh-a11ytree
  - S11
---

# Extractor Survival Recall

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `static-fetch`

## What it checks

Runs the boilerplate-stripping, HTML-to-markdown pipeline that agent readers actually run, then measures what fraction of the page's load-bearing spans survived it. Reports, by name, every key span that was dropped and the container that swallowed it. Also reports the extracted/total text ratio in both directions: over-stripping (answers living in stripped containers) and under-stripping (nav and footer boilerplate diluting the page's embedding).

## Claimed mechanism (falsifiable)

Answer engines and agent readers do not embed raw HTML. They strip boilerplate and convert main content to markdown. Jina Reader states that 'Boilerplate such as navigation, headers, footers, and ads is stripped, and the main content is converted to Markdown' (S10), and Firecrawl exposes the same only-main-content path (S11). These extractors use structural and class-name heuristics. Content placed in <aside>, <footer>, a role=complementary region, or a container whose class matches a stripper blocklist is deleted before embedding, so it can never be retrieved or cited regardless of its quality. Falsifiable and cheap to verify: fetch the same URL through r.jina.ai and check whether the fact is present in the returned markdown.

## Evidence

- **[Lighthouse audit source: agent-accessibility-tree.js](https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/core/audits/agentic/agent-accessibility-tree.js)** — Google Chrome / Lighthouse (repo, URL verified 2026-08-20)
  - It filters the accessibility violations Lighthouse already collects down to about 37 axe rules: button-name, link-name, input-button-name, label, autocomplete-valid, aria-allowed-attr, aria-required-attr, aria-valid-attr-value, tabindex, and the table and definition-list rules. Binary score: any violation scores 0. Crucially it inherits axe's blind spots — axe cannot fail an element that has no interactive semantics at all, and autocomplete-valid only validates tokens that are already present, never their absence.
- **[WebSuite: Systematically Evaluating Why Web Agents Fail](https://arxiv.org/html/2406.01623v1)** — arXiv (study, URL verified 2026-08-20)
  - Per-UI-primitive success rates for natbot and SeeAct. Worst patterns: slider interaction 0% for both agents; tooltip-based information retrieval 0% for both; complex form filling 12.5% (natbot) / 0% (SeeAct). Aggregate: operational actions 85.2%/76.2%, menu navigation 93.8%/81.3%, informational actions 43.8%/40.6%. Taxonomy covers click (button, link, icon button, slider, switch, accordion, dropdown menu, dialog button, snackbar), type (text/date/phone), select (checkbox, multicheck, select, datagrid row).

## Example failure

A product page renders its full specification table inside <aside class="product-sidebar">. Readability and every only-main-content extractor drop the aside wholesale. The markdown an answer engine ingests contains marketing prose, and no dimensions, weight or materials. The page can therefore never be cited for the spec questions it is uniquely qualified to answer. A retailer's thinner page that keeps specs in <main> wins the citation instead.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Implementation deviations

- Two extractors run: `@mozilla/readability` and a Firecrawl/Jina-style stripper. They are reported separately, because their disagreement is itself the signal.
- The stripper removes `script`, `style`, `noscript`, `template`, `nav`, `aside`, `header`, `footer`, `form` and `iframe`. It also removes any element with a class token or id that is a whole word from its blocklist (`AGGRESSIVE_DROP_TOKEN_RE` in `gatherers/extraction.ts`). A substring match would hit whole-page wrappers such as `page-content--banner-enabled`.
- A matched element holding more than half the page's text is kept. Such a rule has matched the page, not a widget. Firecrawl guards the same way.
- Recall is the minimum of the two extractors, not the average. A fact that survives only one is lost to half the agents.
- A span survives when its first eight normalized words appear in the output. `caption`, `dt` and `th` spans may be a single word of four characters or more.
- An `h1` survives Readability when the article title contains it. Readability moves a title-repeating `h1` out of the body.
- Spans inside a hidden subtree are not collected (`hiddenFromReaders`). Readability drops those before scoring.
- JSON-LD strings are key spans only when the visible prose carries them. The prose test and the `textRatio` denominator drop `script`, `style`, `noscript` and `template` first.
- A JSON-LD span's host element is found by walking the DOM in reverse, never by building a `:contains()` selector from page text.
- `textRatio` is reported against its over-strip (0.25) and leakage (0.85) bounds but does not set the status.
- Below 90% recall fails. The 90% to 97% warn band is this implementation's own.

## Deferred

- A third extractor. `content-extraction/extraction-determinism` already compares three.
- Per-page assessment. Only `ctx.pages[0]` is measured.
- Exact ancestor chains for JSON-LD spans. The reported chain is the last node whose text contains the string.
