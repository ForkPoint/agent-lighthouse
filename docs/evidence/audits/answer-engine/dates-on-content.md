---
audit: answer-engine/dates-on-content
audit_id: "9.8"
category: answer-engine
source_file: packages/core/src/audits/answer-engine/dates-on-content.ts
slug: dates-on-content
review_verdict: fix
severity: medium
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# dates-on-content (`9.8`)

> answer-engine · source `dates-on-content.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

AI engines use dates to assess content freshness. Undated content is deprioritized in AI answers because agents cannot verify its recency.

## Code review findings (2026-08-20, 11-agent pass)

The strongest audit in the category: it prefers machine-readable sources (<time datetime>, JSON-LD datePublished/dateModified/uploadDate/dateCreated, article:published_time meta) before falling back to a body-text date regex, and it correctly returns `na` rather than a vacuous pass when no content page exists. Freshness is a real ranking input for recency-sensitive answers. What undermines it: it takes the FIRST <time> on the page as the publication date, it passes the whole site on the first dated page it finds, its text fallback knows only English month names, and it inherits the leaky 'content = fallback pageType' scoping.

**Required fix:** Prefer a <time> that is inside <article> or adjacent to the H1/byline over the first in source order, and prefer the JSON-LD node whose @type is Article/BlogPosting/NewsArticle (or whose mainEntityOfPage matches the URL) over the first node with any date field. Require the numeric branch to parse to a plausible date (year 1990–current+1) before accepting it, which also removes the SKU match. Add locale month names driven by the page `lang`, returning `na` for unsupported languages. Report per-page coverage instead of short-circuiting on the first dated page. Tighten `isArticleContentPage` (shared by four audits) to require a real article signal. Consider surfacing the parsed age, since the guidance is about recency but the check only proves existence.

**False-positive risks:**
- Wrong date, reported confidently: `p.$('time[datetime]').first()` takes the first <time> in source order. On a blog page that is often a related-posts card, a comment timestamp, an event date, or a delivery-estimate <time> — the audit reports 'Found a structured date (<time datetime>)' with a value that is not the page's publication date.
- Same problem in JSON-LD: `findJsonLdDate` walks `flattenJsonLd` and returns the first node with any date field — on a page with an embedded ItemList/Event/VideoObject graph, the date can belong to a different entity than the page.
- English-only text fallback: DATE_PATTERN lists only English month names, so German '15. Januar 2025', French '15 janvier 2025', Spanish '15 de enero de 2025' and Japanese '2025年1月15日' are invisible. A non-English blog without structured dates false-fails.
- The numeric branch matches non-dates: `\d{1,2}[/-]\d{1,2}[/-]\d{2,4}` matches SKUs, model numbers and part codes like '12-34-5678', so the audit can PASS on a page with no date at all and print the SKU as its evidence.
- Ambiguous DD/MM vs MM/DD is never resolved, and the matched string is surfaced verbatim as proof of freshness with no recency validation — a 2011 date passes exactly like a 2026 one, despite the guidance being entirely about recency.
- Site-wide first-hit short-circuit: the loop returns pass on the first dated content page, so a site where only one article is dated reports the whole site as dated; undated pages are never listed.
- Scoping: `isArticleContentPage` accepts every fallback-typed page, so /contact, /privacy-policy and /pricing are treated as content requiring publication dates, and the failure's pageUrl (`contentPages[0].url`) may point at one of them.
- SPA/CSR: dates rendered client-side → false fail.

**Test gaps:**
- No page where the first <time> is a comment/related-post/event timestamp (the main wrong-value risk).
- No non-English visible date.
- No SKU/model-number string ('12-34-5678') proving the numeric branch false-passes.
- No JSON-LD @graph where the date belongs to a nested non-page entity.
- No stale date (2011) — nothing asserts recency is or isn't evaluated.
- No multi-page scan with one dated and several undated articles, showing the first-hit short-circuit.
- No /contact- or /privacy-style page reaching the audit as an 'article content page'.
- No empty-SPA-shell test.

**Overlaps with:** `9.10`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
