---
check: question-heading-answer-span-alignment
title: "Question-Heading Answer Span Alignment"
domain: answer-selection-forensics
status: proposed
evidence_grade: C
uniqueness: unique
difficulty: llm-assisted
scoring_tier: informative (weight 0)
reviewed: 2026-08-20
---

# Question-Heading Answer Span Alignment

> Proposed check. Evidence grade **C** · unique · implementation: `llm-assisted`

## What it checks

For every interrogative heading, checks that the immediately following content is a self-contained declarative answer inside a measurable envelope — appears within the first ~320 characters of the section, is a contiguous span inside one block element, restates a content word from the heading, and is not a teaser or link-out. Roadmap item: the structural half is deterministic, but judging whether the span actually answers the question needs an LLM adjudicator.

## Claimed mechanism (falsifiable)

A citable answer must be a contiguous extractable span: Google's featured snippet is exactly such a span and is deep-linked with an auto-generated text fragment (S12), which the spec constrains to a single block-level element (S2, S3). So a question heading whose answer is spread across three paragraphs, or deferred behind 'here's what you need to know first', has no single span that a citing surface can lift. Chunk segmentation reinforces this: heading-based chunkers (S5) put the heading and the answer in the same chunk only when the answer is near the heading. The honest limitation is that the semantic part — does this sentence answer this question — is not decidable by regex, which is why this is graded C and not scored.

## Evidence

- **[Text fragments](https://web.dev/articles/text-fragments)** — Google / web.dev (vendor-doc, URL verified 2026-08-20)
  - Confirms a shipped answer-surface consumer: "Clicking a featured snippet takes the user directly to the featured snippet text on the source web page. This works thanks to automatically created Text Fragments URLs." Support: Chrome 89+, Edge 89+, Firefox 131+, Safari 18.2+. Restates the boundary rule: "Each of prefix-, start, end, and -suffix can only match text within a single block-level element, but full start,end ranges can span multiple blocks." Opt-out header: Document-Policy: force-load-at-top.
- **[Playwright: Auto-waiting / Actionability checks](https://playwright.dev/docs/actionability)** — Microsoft (vendor-doc, URL verified 2026-08-20)
  - Before click/check/fill/selectOption, Playwright enforces five checks: Visible (non-empty bounding box, not visibility:hidden), Stable (same bounding box over 2 animation frames), Receives Events (element is the hit target at the action point — overlays cause failure), Enabled (not [disabled]/aria-disabled), Editable (not readonly/aria-readonly). Fill requires visible+enabled+editable. This is the exact gate every Playwright-based agent (Playwright-MCP, browser-use, most CUA harnesses) passes through, so each check is a directly testable site-side failure cause.
- **[MCP Specification 2026-07-28 — Caching](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/caching)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - 'Servers MUST include caching hints on results with resultType: "complete"' for server/discover, tools/list, prompts/list, resources/list, resources/templates/list, resources/read. ttlMs is an integer ms; servers MUST provide ttlMs >= 0. If ttlMs is absent clients SHOULD assume 0 = immediately stale. cacheScope is exactly "public" or "private". Servers MUST apply the same cacheScope to all pages of a paginated list. Public scope on an authenticated endpoint may be shared across access tokens — servers MUST NOT rely on cacheScope for access control.
- **[MCP Specification 2026-07-28 — Versioning and Compatibility](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - 'There is no negotiation handshake.' Terminology: Modern = 2026-07-28+ (per-request _meta); Legacy = 2025-11-25 and earlier (initialize handshake). Unsupported version MUST return error code -32022 with data.supported[] and data.requested. Verbatim compatibility matrix: Modern client + Legacy server = FAILS. Legacy client + Modern server = FAILS. Only dual-era implementations bridge. Extensions negotiated via capabilities.extensions map with mandatory reverse-DNS prefix.

## Competitor coverage

Content-optimization tools (Surfer, Clearscope, MarketMuse) score keyword coverage and heading counts, not heading-to-answer-span proximity. Lighthouse's agentic category has no content-semantics audit. Some AEO consultancies advise 'answer in the first 40 words' as a rule of thumb, but no shipping tool measures it against the block-boundary and lexical-overlap constraints, and none checks the answer is a fragment-addressable contiguous span.

## Implementation sketch

Static parse plus an LLM adjudication pass. 1) Detect interrogative headings: text ends with '?' or begins with what/how/why/when/where/who/which/can/do/does/is/are/should/will. 2) Take the section body up to the next heading. 3) Deterministic gates, all reportable without an LLM: (a) proximity — the candidate answer sentence starts within 320 characters of the heading; (b) block containment — the sentence lies wholly inside one block-level element, so it is text-fragment addressable (reuse the addressability engine); (c) lexical anchoring — the sentence shares at least one non-stopword content token with the heading; (d) length envelope — 8 to 40 words; (e) not-a-teaser — does not match /^(in this (article|guide|post|section)|let's|first,? (let's|we)|read on|keep reading|before we|here's what)/i and is not a link-only paragraph. 4) LLM gate: send heading plus candidate span to a judge with a strict rubric returning answers|partial|no, plus the reason. Cache by content hash. 5) Report as advisory findings with the heading, the candidate span, and which gate failed; do not fold into the numeric score while grade is C. 6) Cheap variant for score-free CI: run gates (a)-(e) only, and report coverage as an informational metric.

## Example failure

An h2 reads 'How long does a passport renewal take?' and the section opens 'In this section we'll walk through the renewal timeline, the factors that affect it, and what to do if you're in a hurry.' The number appears 700 characters later, split as 'Standard processing currently runs' in one <p> and '6 to 8 weeks' inside a <strong> in the next. No contiguous single-block span answers the question, so no featured-snippet-style extraction and no text-fragment citation is constructible.

## Scoring

Tier per evidence policy: **informative (weight 0)** — grade C does not meet the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
