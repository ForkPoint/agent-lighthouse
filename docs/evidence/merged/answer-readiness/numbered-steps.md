---
audit: answer-readiness/numbered-steps
audit_id: "9.6"
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/numbered-steps.ts
slug: numbered-steps
review_verdict: fix
severity: medium
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# numbered-steps (`9.6`)

> answer-engine · source `numbered-steps.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

AI engines extract <ol> lists for "how to" answer snippets. Use ordered lists for step-by-step content to improve your visibility in procedural AI-generated answers.

## Code review findings (2026-08-20, 11-agent pass)

Counts `p.$('ol').length` across every scanned page and passes if > 0 — the same file as comparison-tables.ts with `table` swapped for `ol`. Because breadcrumbs, pagination and many nav components are ordered lists, this passes on essentially every themed ecommerce site with no procedural content whatsoever; and it fails sites with no how-to content while telling them to convert steps they don't have. Both outcomes are wrong guidance.

**Required fix:** Require the <ol> to be plausibly procedural: ≥3 <li>, not inside `nav`/`[role=navigation]`/`.breadcrumb`/`.pagination`, and not carrying BreadcrumbList/ItemList microdata; ideally within a section whose heading matches a how-to/steps pattern (language-gated). Filter `ctx.pages` by the audit's own applicablePageTypes. Return `notApplicable()` when no scanned page shows procedural intent, so brands and news sites are not told to invent steps. Also detect manually numbered step sequences to remove the false negative. Consider folding 9.5 and 9.6 into one 'structured content formats' audit, since they are the same check over different tags.

**False-positive risks:**
- Breadcrumbs are the canonical <ol> (schema.org/BreadcrumbList markup guidance and every major theme render breadcrumbs as `<ol class="breadcrumb">`). Any Shopify/WooCommerce/Next-commerce page therefore passes with 'Found 1 ordered list(s)' and zero step-by-step content.
- Pagination (`<ol class="pagination">`), carousels, tab lists, and table-of-contents widgets are also ordered lists — additional sources of the same false pass.
- No content inspection at all: no minimum <li> count, no check that the list items read as steps, no proximity to a 'How to' heading. A 1-item <ol> passes.
- Failure direction is worse: a site with no procedural content gets 'No ordered lists found' and is told to 'Convert any step-by-step or procedural content from paragraphs to <ol>'. For a brand site, a news site, or a legal page this is advice to invent content. `notApplicable()` is never used.
- Runs on all pages despite `applicablePageTypes: ['content']` — the loop is over `ctx.pages`, so a homepage breadcrumb satisfies a content-page audit (category note 2).
- Site-wide OR: one <ol> anywhere passes every page; the reported pageUrl is just the first page that had one.
- SPA/CSR: client-rendered lists → false fail.
- Numbered steps written as `<h3>Step 1</h3><p>…</p>` or as a manually numbered <p> sequence (extremely common in CMS content) are not detected, so genuinely procedural pages fail.

**Test gaps:**
- No breadcrumb `<ol class="breadcrumb">` test — the single most common real-world false pass, and it would fail today.
- No pagination/nav <ol>.
- No single-item <ol>.
- No site without procedural content (should be `na`, currently `fail`).
- No manually numbered steps in headings/paragraphs (the false negative).
- No test that a homepage <ol> satisfies this content-scoped audit.

**Overlaps with:** `9.5`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Graded evidence (2026-08-21)

**Mechanism claim:** Procedural content marked up as `<ol>`/`<li>` survives HTML→markdown conversion and accessibility-tree serialization with step boundaries and step order intact, whereas the same steps written as running prose force the model to re-infer where each step begins and ends.

**Grade: B** — the preservation mechanism is documented at spec and source level across the extraction stack (the same basis on which this repo already graded `semantic-html/semantic-lists` B), but no study isolates ordered lists' effect on citation rate and the audit's own "how-to answer snippet" framing is refuted for the only vendor that ever shipped that surface.

**Evidence:**
- Lists are first-class in the tree agents read: HTML-AAM maps `ol`/`ul`/`li` to `list`/`listitem` roles alongside its `dl`/`dt`/`dd` and table mappings — https://www.w3.org/TR/html-aam-1.0/ (verified 2026-08-21)
- trafilatura's `include_formatting` keeps "structural elements related to formatting (kept in XML, rendered as markdown for text formats)", and markdown's ordered-list syntax carries the numbering — https://trafilatura.readthedocs.io/en/latest/corefunctions.html (verified 2026-08-21)
- The same conversion is now infrastructure: Cloudflare's Markdown for Agents "automatically converts any HTML page requested from our network to markdown", reporting "a 80% reduction in token usage" on its own post (16,180 HTML tokens → 3,150 markdown) — https://blog.cloudflare.com/markdown-for-agents/ (verified 2026-08-21)
- Measured extraction benefit for the format class: GEO-SFE reports "structured formats (lists, tables) demonstrate 43% higher extraction accuracy than equivalent prose", within an overall 17.3% citation-rate improvement (p<0.001, Cohen's d = 0.64) — https://arxiv.org/html/2603.29979v1 (verified 2026-08-21)

**Counter-evidence:** The audit's stated mechanism — that AI engines extract `<ol>` for "how to" answer snippets — is refuted for the one vendor that shipped such a surface: Google's HowTo structured data documentation records the feature as "no longer shown in search results, on both desktop and mobile devices", removed 14 September 2023 (https://developers.google.com/search/docs/appearance/structured-data/how-to). No study separates `<ol>` from `<ul>` or isolates lists from tables — the GEO-SFE 43% figure covers both formats together. Google states there is no special markup or writing style required for generative AI features (https://developers.google.com/search/docs/appearance/ai-features, https://developers.google.com/search/docs/fundamentals/ai-optimization-guide), and C-SEO Bench found "Most current C-SEO methods are not only largely ineffective but also frequently have a negative impact on document ranking" (https://arxiv.org/abs/2506.11097). Finally, this signal is not independent: it rests on the same evidence as `semantic-html/semantic-lists` (already grade B), and presence of any `<ol>` anywhere on a page — a breadcrumb trail, a paginated nav — is not evidence that procedural content is enumerated. Scoring both audits double-counts one mechanism. All URLs verified 2026-08-21.

**Merged into:** `content-extraction/semantic-lists` (Plan 4, 2026-08-22, late fold) — [merged dossier](../../audits/content-extraction/semantic-lists.md)

_9.6's v1 row was a `move` (renamed to `answer-readiness/numbered-steps`), not a `merge-away`; the fold was decided during Plan 4 on this dossier's own grading, and `migration-map.json` carries a `note` on the 9.6 row recording it._
