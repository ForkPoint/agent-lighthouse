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

- **[Readability.js source — _isProbablyVisible](https://raw.githubusercontent.com/mozilla/readability/main/Readability.js)** — Mozilla (repo, URL verified 2026-08-20)
  - Visibility test is literally: node.style.display != "none" && node.style.visibility != "hidden" && !node.hasAttribute("hidden") && aria-hidden!="true". Only inline styles and attributes are consulted — "It does not evaluate class-based CSS rules from stylesheets." Proof that content hidden by an external stylesheet class is ingested as if visible by the most widely deployed extractor.
- **[The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler)** — Vercel (study, URL verified 2026-08-20)
  - "none of the major AI crawlers currently render JavaScript" — explicitly GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot — though they do fetch JS files as text (ChatGPT 11.50%, Claude 23.84% of requests). ChatGPT spends 34.82% and Claude 34.16% of fetches on 404s vs Googlebot's 8.22%. Establishes that (a) what an AI crawler ingests is the raw HTML byte stream with no CSS/JS applied, and (b) per-fetch yield is already terrible, so wasted tokens per fetch compound.
- **[Large Language Models Can Be Easily Distracted by Irrelevant Context](https://arxiv.org/abs/2302.00093)** — Shi et al., ICML 2023 (arXiv 2302.00093) (study, URL verified 2026-08-20)
  - Introduces GSM-IC; finds "the model performance is dramatically decreased when irrelevant information is included" in the prompt, mitigated only partially by self-consistency and explicit ignore-instructions. Grounds the claim that boilerplate/duplicate/hidden text in an ingested page degrades answer quality, not just cost.
- **[Structured data general guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)** — Google (vendor-doc, URL verified 2026-08-20)
  - "Don't mark up content that is not visible to readers of the page"; "Your structured data must be a true representation of the page content"; hidden content is listed as a reason rich results fail. Constrains the JSON-LD bloat check: the fix is never "delete schema", it is "stop shipping the entire body twice".
- **[mozilla/readability](https://github.com/mozilla/readability)** — Mozilla (repo, URL verified 2026-08-20)
  - parse() returns title, content, textContent, length, excerpt, byline, dir, siteName, lang, publishedTime; charThreshold default 500 chars below which no article is returned; isProbablyReaderable uses minContentLength 140 and minScore 20. Gives concrete pass/fail hooks (null result, length, title) for an extractability check.

## Competitor coverage

Accessibility audits (including Lighthouse's a11y and its accessibility-for-agents checks) reason about hidden content from the opposite direction — whether hidden things are correctly hidden from AT — never about hidden text being over-ingested by non-rendering consumers. Google's structured-data policy covers hidden markup but not hidden DOM text volume. Nobody sizes it in tokens.

## Implementation sketch

Fetch HTML plus every same-origin <link rel=stylesheet> and inline <style>. Parse CSS with postcss; collect selectors whose declarations include display:none, visibility:hidden, content-visibility:hidden, or clip-path/position:absolute with 1px sizing (the sr-only idiom). Match those selectors against the DOM with css-select over linkedom, excluding nodes that already carry an inline hidden marker (those are the ones Readability handles). Sum textContent tokens of matched subtrees. For duplication, shingle each hidden block against the visible text. Known approximation: no cascade or specificity resolution and no media-query evaluation — mitigate by ignoring rules inside print media and by reporting matched selector text as evidence so a human can adjudicate. Exact resolution via getComputedStyle is a headless roadmap upgrade.

## Example failure

A SaaS pricing page ships desktop nav, mobile nav and a hidden search-overlay menu. It also ships all four collapsed FAQ answers, and a `.legacy-pricing` block kept in the DOM behind display:none. 3,900 of the page's 5,600 text tokens are never seen by a human. An agent asked 'how much is the Pro plan' reads the legacy $29 from the hidden block alongside the live $49, and reports the wrong price with confidence.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

- **No `postcss`, `linkedom` or `css-select`.** The global constraint forbids new
  runtime dependencies, so stylesheet scanning uses the local
  `packages/core/src/gatherers/css-rules.ts` scanner (selector list +
  declaration block, at-rule prelude retained) and selector matching uses
  cheerio's `$(selector)`.
- **No tokenizer.** Token counts are `characters / 4` (`CHARS_PER_TOKEN = 4`),
  the same estimator `content-extraction/token-ratio` uses. Counts are labelled
  `est. tokens` everywhere they surface.
- **No cascade, no specificity, no media-query evaluation.** The scanner asks
  only whether *any* rule that could apply to an element declares a hiding
  property. Rules inside `@media print` are ignored, and at-rule bodies that
  hold declarations rather than selectors (`@font-face`, `@keyframes`, `@page`)
  are skipped wholesale. The matched selector text is reported verbatim in the
  finding so a human can adjudicate a match the scanner cannot resolve exactly.
- **Cross-origin stylesheets are never fetched.** Their count is appended to the
  `found` string, so a result built on partial CSS says so.
- Elements already carrying an inline hidden marker (`hidden`, `aria-hidden="true"`,
  inline `display:none` / `visibility:hidden`) are excluded: Readability honours
  those, so their text is not ingested and costs nothing.
- Nested matches are counted once — only the outermost hidden element of a
  subtree contributes tokens.
- 2026-08-28 — the audit declines when the scan holds no response it can
  attribute to this site. `ctx.pages` and `ctx.rootFiles` carry whatever
  answered 200, which on a parked domain is a broker's page served from another
  host and on a walled, throttled or non-HTML origin is nothing about the site
  at all. The audit read them as the site's own and returned a verdict about
  somebody else. It now consults `scanReadTheSite`, the `origin-reachable`
  decision it already names in `requires`, and returns `notApplicable` with the
  gate's reason attached. Found by the hostile-state contract suite.

## Deferred

- Exact style resolution through `getComputedStyle` in a headless browser stays
  a roadmap item; it would replace the scanner, not supplement it.
- Contradiction risk is reported as a signal (prices, availability, dated
  claims found inside hidden text) rather than adjudicated against the visible
  copy.
