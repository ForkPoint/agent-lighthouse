---
audit: answer-readiness/meta-description
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/meta-description.ts
slug: meta-description
evidence_grade: B
disposition: "merged 2026-08-22 (Plan 4, Task 6) — absorbs meta-description-aeo (9.11)"
reviewed: 2026-08-22
sources:
  - google-snippet-docs
  - google-special-tags
  - whatwg-metadata-names
  - google-ai-features-trust
  - s18
---

# meta-description (`4.1`, `9.11`)

> answer-readiness · source `meta-description.ts` · merged, absorbs meta-description-aeo (9.11) · evidence grade **B** · tier **scored** (weight 0.6)

## What it checks

`<meta name="description">` on `ctx.pages[0]`, against the properties Google documents for it — presence, a usable length, prose rather than a keyword run, and relevance to this page.

| State                                                                                                 | Result                    |
| :---------------------------------------------------------------------------------------------------- | :------------------------ |
| no description tag                                                                                    | `fail`, priority `high`   |
| present, length outside 50–300                                                                        | `warn`, priority `high`   |
| present, in range, but a keyword string (5+ comma/pipe-separated fragments of ≤ 4 words, no sentence) | `warn`, priority `medium` |
| present, in range, prose, but sharing no content term with the page's `<title>`/`<h1>`                | `warn`, priority `medium` |
| present, in range, prose, on-topic                                                                    | `pass`                    |

The two quality states are the absorbed half (9.11). Neither can produce a `fail`: a description that exists is never worse than one that does not.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** A search engine or answer engine that indexes the page reads `<meta name="description">` and may reproduce its text verbatim as the page's summary/snippet instead of generating one from body text.

**Grade: B** — Google documents that Search reads the tag and may use it as the snippet, and the tag is a WHATWG-standard metadata name with near-universal adoption. But the consumption is explicitly conditional — "sometimes" — no AI-agent vendor documents reading it, and the audit's 50-300 character window has no primary support.

**Evidence:**

- Google Search Central states the tag is a snippet source: "Google sometimes uses the meta description HTML element if it might give users a more accurate description of the page than content taken directly from the page." — https://developers.google.com/search/docs/appearance/snippet (verified 2026-08-21)
- `description` is one of the meta tags Google Search explicitly supports (the same page notes "Google will ignore `meta` tags that it doesn't support") — https://developers.google.com/search/docs/crawling-indexing/special-tags (verified 2026-08-21)
- WHATWG HTML defines `description` as a standard metadata name whose value "must be appropriate for use in a directory of pages, e.g. in a search engine" — https://html.spec.whatwg.org/multipage/semantics.html#standard-metadata-names (verified 2026-08-21)
- Google's AI-features guidance confirms AI Overviews/AI Mode are built on Search and are governed by the same snippet controls (`nosnippet`, `max-snippet`, `data-nosnippet`), which is the only documented link between snippet text and AI answers — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21)

**Counter-evidence:** No AI vendor documents reading this tag. OpenAI's crawler documentation (GPTBot, OAI-SearchBot, ChatGPT-User, OAI-AdsBot) describes only robots.txt and user-agent behavior and mentions no HTML metadata at all — https://developers.openai.com/api/docs/bots (verified 2026-08-21). Google's AI-features page likewise never mentions meta description — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21). The audit's 50-300 character gate is contradicted by the primary source. "There's no limit on how long a meta description can be, but the snippet is truncated in Google Search results as needed, typically to fit the device width" — https://developers.google.com/search/docs/appearance/snippet (verified 2026-08-21). The claim that the tag is the "primary summary" an agent uses when generating answers is unsupported: ChatGPT-User, ClaudeBot and PerplexityBot fetch and read full page bodies, so the tag is at best one candidate among many.

## Implementation deviations

- The audit merges the former `meta-description-aeo` audit, whose record is in `docs/evidence/merged/answer-readiness/`. Its "action/result formula" is not carried over. No consuming system documents it.
- The absorbed quality checks follow Google's snippet criteria. A run of five or more comma- or pipe-separated fragments of at most four words reads as a keyword string. A description that shares no content term with the title and first H1 does not describe the page.
- The overlap test needs at least two subject terms. A brand-only title is a thin subject, not evidence of an off-topic description.
- The stop-word list is English. On other languages it removes nothing, so the overlap test fires less often, never more.
- Both quality branches warn at priority `medium`. Their C-grade evidence adds criteria, not strength, so the grade stays B.
- The length window stays 50 to 300 characters. Google states there is no length limit, so a tighter 110 to 160 window is not adopted.
- Uniqueness across pages is left to `unique-meta`.

## Deferred

- Trim the description before the length test. A whitespace-only description of usable length passes.
- Count length in characters a reader sees, not UTF-16 code units.
- Iterate all sampled pages instead of `ctx.pages[0]`.
- Fall back to `og:description`.
