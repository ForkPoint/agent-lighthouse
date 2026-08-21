---
audit: generative-engine/pagination-links
audit_id: "10.12"
category: generative-engine
source_file: packages/core/src/audits/generative-engine/pagination-links.ts
slug: pagination-links
review_verdict: delete
severity: medium
evidence_grade: D
disposition: "sunset (approved 2026-08-21)"
reviewed: 2026-08-21
---

# pagination-links (`10.12`)

> generative-engine · source `pagination-links.ts` · review verdict **delete** · evidence grade **D** · disposition: **sunset (approved 2026-08-21)**

## What it checks

AI crawlers use rel="prev" and rel="next" to navigate paginated content series without missing pages.

## Code review findings (2026-08-20, 11-agent pass)

Obsolete signal plus an inverted default. Google dropped `rel=prev/next` as an indexing signal in 2019 and no AI crawler has since adopted it; GPTBot, ClaudeBot, PerplexityBot and agentic browsers follow visible anchors, sitemaps or JS pagination. On top of that the audit WARNS on every site with no paginated content — most sites — so its dominant real-world output is a warning about the absence of a feature the site correctly does not need. That is a false result by construction, not an edge case; the inline comment even concedes 'their absence is not critical' while the code warns anyway.

**Required fix:** If retained instead of deleted: first detect whether pagination exists at all (a `?page=`/`/page/N` URL among scanned pages, or visible pagination controls) and return `notApplicable()` when it doesn't; match `rel` token-wise and case-insensitively; also accept `<a rel="next">` in the body; and scope evaluation to `pageType === 'category'` pages only. Given no 2026 AI crawler consumes `rel=prev/next`, deletion is the honest action.

**False-positive risks:**
- The final branch is `this.warn('No <link rel="prev"> or <link rel="next"> found on any page.')` with no check for whether any scanned page is actually paginated. A brochure site, a docs site or a SaaS landing page — none has or needs pagination, and all get a warning, despite `notApplicable()` being available on the base class.
- `applicablePageTypes: ['category']` gates execution on at least one category page existing, but the loop runs over ALL pages, so a `rel=next` in the homepage head (emitted by some themes for the blog feed) passes the audit on behalf of the category pages that lack it.
- `p.headLinks.some((l) => l.rel === 'prev')` is exact string equality on the rel value. `rel="Next"` (case variants are legal) and multi-token `rel="next nofollow"` — both real — do not match, producing a false 'not found' on a site that did implement it.
- Only `<link>` elements in `<head>` are considered. A site implementing pagination with `<a rel="next">` in the body — the more common modern pattern, and the one crawlers actually follow — is reported as having no pagination links.
- One page anywhere in the scan having prev OR next reports 'Pagination links found' for the whole site.

**Test gaps:**
- No test for a site with no paginated content at all — the modal case, where the current behavior (warn) is wrong.
- No test for `rel="next nofollow"` or `rel="Next"` casing.
- No test for body-level `<a rel="next">`.
- No test where the pagination link is on the homepage but the category pages lack it.

**Overlaps with:** _none_

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/generative-engine/pagination-links.md](../../deletions/generative-engine/pagination-links.md). Outcome: **dead**, grade D.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
