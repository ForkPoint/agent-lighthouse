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

## The merge and the redemption (Plan 4, Task 6, 2026-08-22)

9.11 `meta-description-aeo` carried both a `TODO(merge)` and a `TODO(redeem)` header, and the redeem note is one sentence: _"Redeem via merge into meta-description: one audit, quality criteria without the invented 'AEO formula'."_ Both halves of that are executed here.

### What "the AEO formula" was, and what was dropped

The "AEO formula" is 9.11's own headline claim: that a meta description should follow an **action/result** shape — _"Learn how to X to achieve Y"_ — and that this shape "matches more user queries than generic marketing language". It appeared in the audit's title (`Meta description follows AEO formula`), its description, its `guidance.fix` ("Rewrite your meta description using an action/result formula"), and in code as `ACTION_RESULT_PATTERN`. 9.11's review calls it what it is: _"The 'action/result formula' it promotes is SEO folklore with no consuming system"_, and the map row for 9.11 says the same — _"the invented 'AEO formula' is dropped"_.

Dropped in this fold, and nothing carried over from them:

- `ACTION_RESULT_PATTERN` — `/\b(learn|…|try|start)\b.*\b(how|what|…|features)\b/i`, which "Use our features" satisfies, and the `"Meta description follows an action/result pattern."` verdict it produced.
- `hasProperNoun` — `/\S+\s+.*\b[A-Z][a-zA-Z]{2,}/`, one capitalized word after the first token. Any two-sentence description passed automatically, and every German description passed always.
- `hasNumber` — `/\d/`, so a phone number or "Est. 1998" counted as answer-bearing specificity.
- `CONCRETE_SIGNAL` — a hand-picked apparel/jewelry word list (cotton, merino, cashmere, gold…) that privileged one vertical and did nothing for SaaS, services or non-English copy.
- `GENERIC_DOMINATES` — the near-unreachable warn: it required the description to start with discover/explore/shop _and_ contain no period at all, so "Discover our solutions. Trusted by 500 teams." skipped it into the catch-all pass.
- The catch-all `pass('Meta description is present and substantive.')`, whose real semantics were `desc !== ''` — a presence check 4.1 already performs.

Two tests pin the removal: an action/result-shaped description that does not describe its page now warns (v1 passed it, naming the pattern), and a German description with a capitalized noun no longer passes on that alone.

### What was ported instead

9.11's required fix names the replacement: _"replace it with something falsifiable and per-page — e.g. description length in the 110–160 range, non-duplication across scanned pages, and term overlap with the page's H1/title"_, and its graded evidence says to _"grade it on the documented Google criteria (present, unique, accurate, human-readable, matches page content)"_. Of those:

- **Human-readable, not a keyword string** — implemented. Google's snippet doc asks for descriptions that are readable text rather than "long strings of keywords"; a run of five or more comma/pipe-separated fragments of at most four words each, with no sentence break, is that shape.
- **Matches page content** — implemented as the term-overlap test the review proposes: content words (3+ characters, a short stop list removed) of the description against those of the page's `<title>` plus first `<h1>`. Zero shared terms is the finding. The check is skipped entirely when the page has neither a title nor an H1, so it cannot fire without something to compare against.
- **Unique across pages** — deliberately **not** implemented here. `answer-readiness/unique-meta` (4.5) is a live audit that checks exactly this, and 9.11's own review names it as the reason: _"Meta-description presence and length are already covered by meta-tags/meta-description (4.1) and unique-meta (4.5)"_. Re-checking it would re-create the double-scoring this fold exists to remove.
- **The 110–160 length window** — deliberately **not** adopted; see Deviations.

### Absorbed evidence — meta-description-aeo (9.11)

9.11's dossier is kept verbatim at [merged/answer-readiness/meta-description-aeo.md](../../merged/answer-readiness/meta-description-aeo.md) (grade **C**). Its signal — "meta description _quality_ for AI snippets" — splits cleanly in two, and the split is why the merged audit looks the way it does:

- The **classic-search half is documented**, and is the same chain 4.1 is graded on: Google "sometimes uses the meta description HTML element if it might give users a more accurate description of the page", and prescribes auditable properties — unique per page, human-readable rather than "long strings of keywords", page-specific detail. Those are the criteria ported above.
- The **AI-specific half is unproven**: "No vendor — Google, OpenAI, Anthropic, Perplexity or Microsoft — documents meta description as an input to answer selection or citation… The claims circulating that 'meta descriptions often become the snippet that ChatGPT or Bing Chat quote directly' come from SEO vendor blogs with no measurement."

The merged audit therefore stops asserting the AI mechanism. 4.1's own text claimed the tag is "the primary summary of your page when generating answers"; the description, the guidance and both finding messages now describe the documented snippet path (and its inheritance by AI Overviews / AI Mode through the shared `nosnippet` / `max-snippet` controls) instead.

### Grade decision: stays **B**, tier `scored`, weight 0.6

4.1 grades **B**: Google documents that Search reads the tag and may use it as the snippet, and it is a WHATWG standard metadata name — but consumption is explicitly conditional ("sometimes") and no AI vendor documents reading it. 9.11 grades **C**, and its C attaches specifically to the _AI-specific_ quality claim the merged audit no longer makes; the part that survives is the documented Google-criteria half, which is the same evidence 4.1's B already rests on. So the absorbed evidence adds criteria, not strength: **B**, `tier: scored`, `weight 0.6` (`weightForGrade('B', 'scored')`).

That is also why the quality branches warn rather than fail. `defaultPriority` stays `high` (the missing-tag case); the two absorbed branches set `medium` per result.

### Deviations

- **The 110–160 character window is not adopted.** 9.11's review offers it as an example, but 4.1's own graded evidence contradicts a tight window with the primary source: "There's no limit on how long a meta description can be, but the snippet is truncated in Google Search results as needed, typically to fit the device width." Narrowing 50–300 to 110–160 would make the audit stricter on the one criterion the evidence says is unsupported. The existing window is kept, and its finding text no longer asserts a cited-more claim for it.
- **Non-duplication is left to 4.5** (above), so a boilerplate description repeated site-wide is still reported — by `unique-meta`, once.
- **4.1's own required fixes stay open**: no `.trim()` before the length test (a whitespace-only description still passes), UTF-16 length counting on CJK/Thai/Arabic copy, `ctx.pages[0]` only, no `og:description` fallback, no WAF `notApplicable`. 4.1 is a `move` row with an open `fix` verdict; this fold does not claim them, and the quality half inherits the same single-page scope.
- **The overlap test is English-tuned** in one respect: the stop-word list is English. It degrades safely — for a non-English page the list simply removes nothing, so more terms are compared and the check is _less_ likely to fire, never more.
