---
audit: answer-readiness/dates-on-content
audit_id: "9.8"
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/dates-on-content.ts
slug: dates-on-content
review_verdict: fix
severity: medium
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# dates-on-content (`9.8`)

> answer-engine · source `dates-on-content.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

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

## Graded evidence (2026-08-21)

**Mechanism claim:** A content page carrying a machine-readable date — `<time datetime>`, `datePublished`/`dateModified` in JSON-LD, an `article:published_time` meta tag, or a clearly labeled visible date — yields a byline date to Google's date extractor and to the htmldate/trafilatura extraction stack; a page carrying none of these yields no date at all, so no downstream consumer can attach a publication time to the document.

**Grade: A** — a vendor doc states in so many words that Google reads exactly these signals off the page, and prescribes exactly the markup this audit checks; the same fields are what the open extraction stack that builds RAG and training corpora reads.

**Evidence:**
- Google Search Central documents the consumer behavior directly: "A *byline date* is the date that Google estimates that the web page was updated or published. When Google can determine the byline date of your page or video, it can expose this information in Search results, if this information is considered to be useful to the user." It then prescribes both halves of what this audit detects — a prominently displayed visible date with clear labeling ("Posted", "Published", "Last updated") *and* "a subtype of `CreativeWork` (such as `Article`, `BlogPosting`, or `VideoObject`)" specifying "the `datePublished` and/or `dateModified` fields" — asking that "the date (and optional time and timezone) match between the equivalent user-visible and structured values" — https://developers.google.com/search/docs/appearance/publication-dates (verified 2026-08-21)
- The Search path is the AI-answer path, per Google's own eligibility rule: "To be eligible to be shown as a supporting link in AI Overviews or AI Mode, a page must be indexed and eligible to be shown in Google Search with a snippet" — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21)
- The open extraction stack reads the same fields in the same priority order the audit uses: htmldate identifies "original and updated publication dates" from "`link` and `meta` elements including Open Graph protocol attributes", "`abbr` or `time` elements and a series of attributes", then page text, and is "used in production on millions of documents" — https://htmldate.readthedocs.io/en/latest/ (verified 2026-08-21). It sits under trafilatura, whose extraction keeps structure and metadata — https://trafilatura.readthedocs.io/en/latest/corefunctions.html (verified 2026-08-21)
- A second vendor ties freshness to AI answers explicitly: Bing states that freshness signals "directly influence how quickly updates are reflected in search results and AI generated answers" — https://blogs.bing.com/webmaster/July-2025/Keeping-Content-Discoverable-with-Sitemaps-in-AI-Powered-Search (verified 2026-08-21)

**Counter-evidence:** The audit's *stated impact* — "Undated content is deprioritized in AI answers" — is not documented anywhere. Google's AI-features and AI-optimization pages never mention dates or freshness at all, and both state that no special structured data is required ("There's also no special schema.org structured data that you need to add", https://developers.google.com/search/docs/appearance/ai-features). Bing's freshness statement is about sitemap `<lastmod>`, not on-page dates, so it does not transfer directly. No OpenAI, Anthropic or Perplexity crawler documentation mentions dates; OpenAI's bots page describes OAI-SearchBot, GPTBot and ChatGPT-User purely by purpose (https://developers.openai.com/api/docs/bots). The grade therefore covers the extraction claim above, not a ranking claim — and note that the audit's visible-text fallback regex matches any date-shaped string in main content (a copyright year, an event date, a comment timestamp), which is not a byline date; only the structured branch is what the vendor documentation supports. All URLs verified 2026-08-21.
