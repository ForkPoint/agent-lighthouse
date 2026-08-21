---
audit: generative-engine/pagination-links
category: generative-engine
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

## Review history

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **sunset** (graceful sunset per evidence-policy deprecation process; condensed rationale kept in NOT-A-FACTOR.md).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.
