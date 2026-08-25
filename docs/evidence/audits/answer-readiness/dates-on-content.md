---
audit: answer-readiness/dates-on-content
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/dates-on-content.ts
slug: dates-on-content
evidence_grade: A
disposition: "merged 2026-08-22 (Plan 4, Task 6) — absorbs last-updated-indicator (9.10)"
reviewed: 2026-08-22
sources:
  - google-publication-dates
  - google-ai-features-trust
  - htmldate-docs
  - trafilatura-corefunctions
  - bing-sitemaps-ai-search
  - s18
---

# dates-on-content (`9.8`, `9.10`)

> answer-readiness · source `dates-on-content.ts` · merged freshness audit, absorbs last-updated-indicator (9.10) · evidence grade **A** · tier **scored** (weight 1.0)

## What it checks

One freshness question per content page, scored once: **can a date extractor date this page, and can it tell how current it is?**

| State | Result |
| :--- | :--- |
| a modification date — JSON-LD `dateModified`, `article:modified_time` / `og:updated_time`, a `<time>` carrying an "updated/modified/revised" label, or that wording beside a parseable date in the text | `pass` |
| a publication date only — `<time datetime>`, JSON-LD `datePublished`/`uploadDate`/`dateCreated`, `article:published_time`, a bare `<time>`, or a visible date pattern | `warn` (0.5), priority `low` |
| neither, on any scanned content page | `fail`, priority `medium` |
| no article content page scanned | `na` |

The update signal wins wherever it is found: every content page is checked for one before the first publication-only date is reported.

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

**Overlaps with:** `9.10` — now absorbed here, so the overlap is resolved.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Evidence (2026-08-21)

**Mechanism claim:** A content page carrying a machine-readable date yields a byline date to Google's date extractor and to the htmldate and trafilatura extraction stack. That date can be a `<time datetime>` element, `datePublished` or `dateModified` in JSON-LD, an `article:published_time` meta tag, or a clearly labeled visible date. A page carrying none of these yields no date at all, so no downstream consumer can attach a publication time to the document.

**Grade: A** — a vendor doc states in so many words that Google reads exactly these signals off the page, and prescribes exactly the markup this audit checks; the same fields are what the open extraction stack that builds RAG and training corpora reads.

**Evidence:**
- Google Search Central documents the consumer behavior directly: "A *byline date* is the date that Google estimates that the web page was updated or published. When Google can determine the byline date of your page or video, it can expose this information in Search results, if this information is considered to be useful to the user." It then prescribes both halves of what this audit detects. One half is a prominently displayed visible date with clear labeling ("Posted", "Published", "Last updated"). The other is "a subtype of `CreativeWork` (such as `Article`, `BlogPosting`, or `VideoObject`)" specifying "the `datePublished` and/or `dateModified` fields". Google asks that "the date (and optional time and timezone) match between the equivalent user-visible and structured values" — https://developers.google.com/search/docs/appearance/publication-dates (verified 2026-08-21)
- The Search path is the AI-answer path, per Google's own eligibility rule: "To be eligible to be shown as a supporting link in AI Overviews or AI Mode, a page must be indexed and eligible to be shown in Google Search with a snippet" — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21)
- The open extraction stack reads the same fields in the same priority order the audit uses. htmldate identifies "original and updated publication dates" from "`link` and `meta` elements including Open Graph protocol attributes", then "`abbr` or `time` elements and a series of attributes", then page text. It is "used in production on millions of documents" — https://htmldate.readthedocs.io/en/latest/ (verified 2026-08-21). It sits under trafilatura, whose extraction keeps structure and metadata — https://trafilatura.readthedocs.io/en/latest/corefunctions.html (verified 2026-08-21)
- A second vendor ties freshness to AI answers explicitly: Bing states that freshness signals "directly influence how quickly updates are reflected in search results and AI generated answers" — https://blogs.bing.com/webmaster/July-2025/Keeping-Content-Discoverable-with-Sitemaps-in-AI-Powered-Search (verified 2026-08-21)

**Counter-evidence:** The audit's *stated impact* — "Undated content is deprioritized in AI answers" — is not documented anywhere. Google's AI-features and AI-optimization pages never mention dates or freshness at all, and both state that no special structured data is required ("There's also no special schema.org structured data that you need to add", https://developers.google.com/search/docs/appearance/ai-features). Bing's freshness statement is about sitemap `<lastmod>`, not on-page dates, so it does not transfer directly. No OpenAI, Anthropic or Perplexity crawler documentation mentions dates; OpenAI's bots page describes OAI-SearchBot, GPTBot and ChatGPT-User purely by purpose (https://developers.openai.com/api/docs/bots). The grade therefore covers the extraction claim above, not a ranking claim. Note also that the audit's visible-text fallback regex matches any date-shaped string in main content — a copyright year, an event date, a comment timestamp — none of which is a byline date. Only the structured branch is what the vendor documentation supports. All URLs verified 2026-08-21.

## The merge (Plan 4, Task 6, 2026-08-22)

9.8 and 9.10 read the same pages through the same shared helper (`isArticleContentPage`), duplicated `DATE_PATTERN` character-for-character, and measured the same underlying thing — "is there a machine-readable date on this content page". A site fixed both with one `<time>` element and was scored twice for one omission.

9.10's required fix is executed as written: *"Merge into 9.8 as a single graded freshness audit scored once: pass when a `dateModified` / 'last updated' + date is present; partial-pass (0.5) when only a publication date exists; fail when neither."* That is exactly the three-state table above, and it also collapses the duplicated `DATE_PATTERN` to one definition in this file (`publication-date.ts` still carries its own copy — that third copy is out of scope here and remains a live hazard the reviews already record).

**What changes for a real site.** A publication-only article scored 1.0 on 9.8 and 0.0 on 9.10 — an average of 0.5 across two weighted checks. It now scores 0.5 on one. The aggregate verdict is preserved while the double weight is not, which is the point of the fold. Two consequences follow:

- **The false fail is gone.** A freshly published, correctly dated article that has never been revised has no reason to carry "Last updated", yet 9.10 failed it at `medium` priority — bad guidance that rewards fake update stamps. It is now a `low`-priority partial, and the fix text says to add the modification date *when, and only when, you actually revise the page*.
- **The incidental-prose warn is gone by construction.** 9.10 warned on any "updated/modified/revised" wording with no date near it ("we updated our packaging"). There is no keyword-only branch left: update wording is only ever accepted with a parseable date beside it, and a page with no date anywhere is a `fail`, not a warn.

### Absorbed evidence — last-updated-indicator (9.10)

9.10's dossier is kept verbatim at [merged/answer-readiness/last-updated-indicator.md](../../merged/answer-readiness/last-updated-indicator.md) (grade **B**). Its evidence base is the same as this audit's — Google's byline-date guidance, htmldate/trafilatura, Bing's freshness statement — read for the modification half: Google asks for a prominently displayed date with clear labeling such as "Posted", "Published" or "Last updated" *and* for `datePublished` and/or `dateModified` on a `CreativeWork` subtype, with the visible and structured values matching; htmldate resolves "original **and updated** publication dates" as first-class outputs.

Its counter-evidence is what fixes the merged shape. 9.10 is graded **B** precisely because the claim that distinguished it — that an explicit update *label* outranks a bare publication date in AI answers — has no documented consumer and no measured effect: "the label is a display convention Google recommends for its own date estimation, not a demonstrated ranking input." Its own dossier also states the signal "is not independent: this audit shares its detector, its date regex and its entire evidence base with `answer-engine/dates-on-content`… scoring both would double-count one signal." So the absorbed half becomes the *upper* state of one scale rather than a second score.

### Grade decision: stays **A**, tier `scored`, weight 1.0

The strongest **proven** path is 9.8's extraction claim, graded **A** — a vendor doc states that Google reads exactly these signals off the page and prescribes exactly this markup, and the same fields are what the open extraction stack reads. 9.10 grades **B** and is capped by the missing consumer for its distinctive claim. Absorbing a B into an A raises nothing and lowers nothing: **A**, `tier: scored`, `weight 1.0` (`weightForGrade('A', 'scored')`).

`scoreDisplayMode` moves from `binary` to `ternary` — the audit now has a real middle state. `defaultPriority` stays `medium`; the partial branch sets `low` per result.

### Deviations

- **9.10's "if the merge is rejected" list is deliberately not implemented.** Those fixes — constraining the `<time>` keyword scope from `.parent().text()` to the immediate sibling, dropping the incidental-prose warn path, gating both patterns on the page `lang` — are prefixed in the review with "If the merge is rejected, at minimum". The merge was approved. The warn path is gone (above); the parent-scope looseness and the English-only patterns are carried over unchanged and remain open, shared with 9.8's own required fixes.
- **9.8's own required fixes stay open**, as they did before the fold: preferring a `<time>` inside `<article>` over the first in source order, preferring the `Article`/`BlogPosting` JSON-LD node, plausibility-checking the numeric branch, locale month names, per-page coverage instead of a first-hit short-circuit, and tightening `isArticleContentPage` (shared by four audits). 9.8 is a `move` row with an open `fix` verdict; the fold does not claim them.
- **The first-hit short-circuit is retained**, now on the update signal first and the publication date second. Per-page coverage reporting is part of 9.8's open fix list, not of this fold.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-21 — approved: 9.10 folds into 9.8 as one graded freshness audit (§5).
- 2026-08-22 — merged (Plan 4, Task 6); registry 163 → 162 for this fold.
