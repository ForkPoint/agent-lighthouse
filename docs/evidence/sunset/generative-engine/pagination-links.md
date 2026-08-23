---
audit: generative-engine/pagination-links
category: generative-engine
audit_id: "10.12"
source_file: packages/core/src/audits/generative-engine/pagination-links.ts
slug: pagination-links
review_verdict: delete
severity: medium
disposition: "sunset (approved 2026-08-21)"
status: sunset
verdict: dead
evidence_grade: D
reviewed: 2026-08-21
---

# pagination-links — confirmed dead — delete

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **D**.

## Claimed mechanism (steelmanned)

Steelmanned: AI crawlers that build knowledge bases must traverse paginated archives (blog indexes, category listings) completely, or their coverage of the site is truncated at page one. rel=prev/next in the document head is a machine-readable, JS-free declaration of series order that a non-rendering crawler could follow deterministically, without having to infer pagination from anchor text or URL patterns. The falsifiable claim: some named AI crawler or answer engine reads <link rel="prev"/"next"> and uses it to discover or sequence paginated content.

## What we searched

WebSearch was exhausted, so I went straight to the specs and vendor docs. I fetched Google's current pagination guidance (developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading) for Google's stated position. I fetched the WHATWG HTML Standard links chapter twice — once for the prose definitions of the next and prev link types, once specifically for the link-types conformance table — to establish whether the construct the audit checks is even valid HTML. I fetched the IANA Link Relations registry to confirm the relations' formal registration status and defining reference, which is the strongest possible steelman. I then checked OpenAI's crawler docs, Anthropic's crawler support article, and Perplexity's bot docs for any statement that any AI crawler consumes link relations or handles pagination. Attempts to reach Google's 2019 announcement URL and Bing's webmaster guidelines both returned 404.

## Best evidence found for the audit

The strongest evidence for the audit is formal, not behavioral: 'next' and 'prev' are registered link relation types in the IANA Link Relations registry ('Indicates that the link's context is a part of a series, and that the next in the series is the link target'), with the HTML Standard as their defining reference. Google's own current doc concedes residual non-Google use: 'Google no longer uses these tags, although these links may still be used by other search engines' — but names no such engine. That is the entire case. I found no vendor documentation from OpenAI, Anthropic, Perplexity, Google or Microsoft stating that any AI crawler or answer engine reads rel=prev/next, and no empirical GEO/AEO study among the 30 recent papers I enumerated tests pagination markup.

## Counter-evidence

Two independent positive proofs of uselessness. (1) Vendor renunciation: Google's current pagination documentation states flatly 'Google no longer uses these tags', and directs site owners to a different mechanism instead — 'consider using a sitemap file or a Google Merchant Center feed to help Google find all of the products on your site.' The only crawler that ever documented consuming these tags publicly dropped them. (2) Spec invalidity of the exact construct checked: the WHATWG HTML Standard's link-types table marks both 'next' and 'prev' as 'not allowed' on the <link> element — they are Hyperlink-only relations, valid on <a>, <area> and <form>. This audit reads page.headLinks (head <link> elements) and its guidance literally tells users to write '<link rel="prev" href="/blog/page/1">' in <head>. It therefore fails sites for omitting non-conforming markup and instructs them to emit HTML the living standard forbids. Additionally: no AI vendor doc mentions link relations at all (OpenAI's bots page covers user agents, IP ranges and robots.txt only; Anthropic's covers robots.txt only; Perplexity's contains no link-tag or pagination information), and Google's recommended replacements — crawlable <a href> links and sitemaps — are the things an AI-readiness scanner should actually be checking.

## Verdict

**confirmed dead — delete** (grade D)

Grade D. The only named consumer in history publicly stopped using the signal, no AI crawler or answer engine documents reading it, no empirical study measures it, and the specific form the audit checks — rel=prev/next on a head <link> element — is explicitly 'not allowed' by the WHATWG HTML Standard, so the audit's own remediation advice produces invalid HTML. Google's stated substitutes (crawlable anchor links, sitemaps) are already the right targets and belong in other audits. Delete; there is nothing here to reshape into an informative check.

## Sources

- **[Pagination and incremental page loading](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading)** — Google Search Central (vendor-doc, URL verified 2026-08-21)
  - 'Google no longer uses these tags, although these links may still be used by other search engines.' Recommends instead: 'consider using a sitemap file or a Google Merchant Center feed to help Google find all of the products on your site.' Direct vendor renunciation of rel=prev/next.
- **[HTML Standard — 4.6.8 Link types (next, prev)](https://html.spec.whatwg.org/multipage/links.html#sec-link-types)** — WHATWG (spec, URL verified 2026-08-21)
  - Both 'next' and 'prev' are defined as Hyperlink annotations and the link-types conformance table marks the <link> column as 'not allowed' for both. Valid on <a>, <area> and <form> only. The audit checks head <link> elements and recommends <link rel="prev"> markup, which the living standard forbids.
- **[Link Relation Types registry](https://www.iana.org/assignments/link-relations/link-relations.xhtml)** — IANA (spec, URL verified 2026-08-21)
  - 'next' and 'prev' are registered relation types — 'Indicates that the link's context is a part of a series, and that the next/previous in the series is the link target' — with the HTML Standard as the defining reference. Formal registration exists; no consumer is named.
- **[OpenAI crawlers and user agents](https://developers.openai.com/api/docs/bots)** — OpenAI (vendor-doc, URL verified 2026-08-21)
  - Covers user-agent strings, published IP ranges, robots.txt configuration and per-bot use cases. Contains no mention of link relation tags, pagination handling, or JavaScript rendering.
- **[PerplexityBot and Perplexity-User](https://docs.perplexity.ai/guides/bots)** — Perplexity (vendor-doc, URL verified 2026-08-21)
  - Documents PerplexityBot (search indexing, not foundation-model training) and Perplexity-User (user-initiated fetches that generally ignore robots.txt). No information about JavaScript rendering, content signals, authority metrics, pagination handling, or link tag interpretation.

## v1 dossier — what it checked and the 2026-08-20 code review

Merged in on 2026-08-22 from `docs/evidence/audits/generative-engine/pagination-links.md`, so a removed audit has exactly one dossier and it lives here.

### What it checks

AI crawlers use rel="prev" and rel="next" to navigate paginated content series without missing pages.

### Code review findings (2026-08-20, 11-agent pass)

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

### Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **sunset** (graceful sunset per evidence-policy deprecation process; condensed rationale kept in NOT-A-FACTOR.md).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.

- 2026-08-22 — v1 dossier merged in from `docs/evidence/audits/generative-engine/pagination-links.md`; that copy removed (one dossier per removed audit, under `sunset/`).
