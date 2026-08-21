---
audit: answer-engine/numbered-steps
audit_id: "9.6"
category: answer-engine
source_file: packages/core/src/audits/answer-engine/numbered-steps.ts
slug: numbered-steps
review_verdict: fix
severity: medium
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# numbered-steps (`9.6`)

> answer-engine · source `numbered-steps.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

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

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
