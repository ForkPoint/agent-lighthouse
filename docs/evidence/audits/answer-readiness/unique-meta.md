---
audit: answer-readiness/unique-meta
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/unique-meta.ts
slug: unique-meta
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - google-snippet-docs
  - google-title-link-docs
  - google-special-tags
  - s18
  - google-ai-features-trust
---

# unique-meta (`4.5`)

> meta-tags · source `unique-meta.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

AI crawlers use title and description pairs to distinguish between pages. Duplicate meta across pages causes agents to merge or skip content, meaning some of your pages will be invisible in AI-generated answers. Give each page a unique title and description.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Implementation deviations

- 2026-08-28 — the audit declines when the scan holds no response it can
  attribute to this site. It read the title and description of each scanned
  page, and `ctx.pages`/`ctx.rootFiles` carry whatever answered 200 — on a
  parked domain a broker's page from another host, on a walled or throttled
  origin nothing at all. It now consults `scanReadTheSite()` and returns
  `notApplicable` carrying the gate's own reason.
  Verdicts that moved on the five nothing-obtained contract states: walled
  pass → na, throttled pass → na, redirected away pass → na, non-HTML homepage
  pass → na, HTTP 200 bot challenge pass → na. Found by
  `packages/core/src/tests/hostile-state-contract.test.ts`.
- 2026-08-28 — the fewer-than-two-pages branch returned `pass` while its own
  message read "uniqueness check not applicable". The status now matches the
  words: `notApplicable`. Uniqueness needs two pages to compare, and a scan of a
  JS shell — whose links never render, so nothing is discovered to sample —
  routinely holds one. This moves the verdict on every scan holding fewer
  than two distinct canonical pages, not only on a shell: pass → na. This is
  the fix the 2026-08-20 code review recorded as item 5 above and nobody had
  applied. Found by
  `packages/core/src/tests/hostile-state-contract.test.ts`.

## Evidence (2026-08-21)

**Mechanism claim:** A crawler or answer engine keys pages on their `<title>` + `<meta name="description">` pair, so two pages sharing that pair are merged or one of them is dropped, making the dropped page unreachable in generated answers.

**Grade: C** — Google documents that identical titles and descriptions across pages degrade how those pages are presented, which supports the _convention_. But no vendor documents title plus description as a deduplication or merge key. The "invisible in AI-generated answers" step of the claim has no source.

**Evidence:**

- Google on duplicated descriptions: "Identical or similar descriptions on every page of a site aren't helpful when individual pages appear in search results." — https://developers.google.com/search/docs/appearance/snippet (verified 2026-08-21)
- Google on duplicated titles: "It's important to have distinct text that describes the content of the page in the `<title>` element for each page on your site." Boilerplate titles "that vary by only a single piece of information" are called out as bad — https://developers.google.com/search/docs/appearance/title-link (verified 2026-08-21)
- Both signals are real inputs to a named consumer: `description` is on Google's supported-meta-tags list — https://developers.google.com/search/docs/crawling-indexing/special-tags (verified 2026-08-21)

**Counter-evidence:** The documented Google effect is presentational (a less useful snippet, a rewritten title link), not exclusionary — nothing in the cited sources says a duplicate-meta page is merged, skipped, or dropped from the index. Google's own duplicate handling is documented as canonicalization over page _content_ and explicit canonical signals, not over meta pairs. No AI vendor documents any retrieval-time dedup keyed on meta tags. OpenAI's crawler documentation mentions no HTML metadata — https://developers.openai.com/api/docs/bots (verified 2026-08-21). Google's AI-features page describes query fan-out and snippet controls with no reference to meta uniqueness — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21). Legitimate duplicates also exist by design (paginated archives, faceted listings), so the current hard fail at priority `high` overstates a C-grade signal.
