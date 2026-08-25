---
audit: answer-readiness/author-same-as
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/author-same-as.ts
slug: author-same-as
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: informative
consumers:
  - "Google Search (documented: author markup for Article rich results and author disambiguation; content-creator reputation is central to human quality rating)"
  - none-known for AI-citation selection specifically
signals:
  - name: "Named author with credentials, author pages, and sameAs identity links"
    grade: C
    domain: geo-authority
sources:
  - google-qrg-2025
  - google-helpful-content
  - google-article-structured-data
  - schemaorg-sameas
  - google-ai-features-trust
  - geo-paper-arxiv
  - geo-critical-survey-arxiv
  - anthropic-crawlers
  - ahrefs-brand-correlation
  - semrush-technical-seo-ai
---

# author-same-as (`10.2`)

> generative-engine · source `author-same-as.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

AI RAG systems cross-reference author identity across platforms via sameAs URLs. Without external profile links, agents cannot verify author expertise.

## Code review findings (2026-08-20, 11-agent pass)

`sameAs` on an author Person is a legitimate, still-live entity-reconciliation signal that knowledge-graph and LLM grounding pipelines do consume, so the signal is worth auditing. This is the mildest implementation in the category, but it shares the structural defects: shallow JSON-LD walk with no `@id` dereferencing, no page-type filtering, a strict-equality `@type === 'Person'` test that array types defeat, and zero validation that the sameAs URLs are external profile URLs rather than the site's own pages.

**Required fix:** 1) Replace `article['@type'] === 'Person'` with the array-tolerant type test already present in the same file. 2) Build an `@id` → node map from the flattened graph and dereference `{"@id":...}` author references. 3) Exclude URLs whose hostname equals or is a subdomain of `ctx.domain`, and require at least one survivor. 4) Switch to the shared `flattenJsonLd`. 5) Restrict evaluation to `p.pageType === 'content'` and report the real source page. 6) When no page has any author at all, return `notApplicable()` and let 10.1 own that finding — otherwise the same absence is penalized twice.

**False-positive risks:**
- `article['@type'] === 'Person'` is strict string equality. The perfectly valid `"@type":["Person"]` fails this test; the node is then treated as an Article, `article['author']` is undefined, and the loop `continue`s — a false FAIL on valid markup. The same file's own `findJsonLdByType` handles array `@type` correctly, so the two checks in one file disagree.
- No validation that sameAs targets are external. `"sameAs":["https://yoursite.com/about","https://yoursite.com/team"]` passes and is reported as "2 external profile URL(s)", carrying none of the cross-platform verification value the description claims. `ctx.domain` is available and unused.
- No validation that the URL is a person profile. A link to the publisher's LinkedIn *company* page, or `https://en.wikipedia.org/wiki/Cat`, passes as author verification.
- The shallow local `findJsonLdByType` misses `mainEntity`/`isPartOf`-nested Article nodes, and misses the standard `@graph` pattern where `author` is `{"@id":"#/schema/person/1"}` and the Person node with `sameAs` lives as a sibling. The audit only reads inline author objects, so the most schema-mature sites get a false FAIL.
- `applicablePageTypes: ['content']` does not filter pages: a `Person` node with `sameAs` on the homepage (a founder card) satisfies the audit for every article on the site.
- One matching author anywhere on any page passes the whole site — 49 of 50 authors can lack sameAs.

**Test gaps:**
- No test for `"@type":["Person"]` array form on the Person node — a confirmed false-fail path.
- No test for `@id`-reference indirection between Article.author and a separate Person node in `@graph`.
- No test for self-referential sameAs pointing back at the audited domain.
- No test where sameAs is found on a non-content page while content pages lack it.
- No test for `mainEntity`-nested Article.
- No test for a publisher Organization `sameAs` being mistaken for an author signal.

**Overlaps with:** `10.3`

## Evidence

### Signal: Named author with credentials, author pages, and sameAs identity links — grade C (geo-authority)

**Mechanism:** A page carrying a named human author with stated credentials, a linked author/bio page, and schema.org Person sameAs links to external identity references (Wikidata, LinkedIn, ORCID) is more likely to be selected and cited by AI answer engines than an otherwise-identical page with no byline.

**Evidence:** The identity half of this signal is genuinely documented — just not by any AI engine. Google's Search Quality Rater Guidelines of 11 Sept 2025, verified by direct PDF read, structure Page Quality around content-creator identity. Four sections carry it: §2.5.2 'Finding Who is Responsible for the Website and Who Created the Content on the Page', §3.3.4 'Reputation of the Content Creators', §4.5.1 'Inadequate Information about the Website or Content Creator', and §5.5 'Unsatisfying Amount of Information about the Website or Content Creator'. Google's helpful-content doc states verbatim: 'We strongly encourage adding accurate authorship information, such as bylines to content where readers might expect it' and asks 'Do pages carry a byline, where one might be expected?'. Google's Article structured-data doc documents author.name and author.url — 'a web page that uniquely identifies the author of the article... an "about me" page, or a bio page' — and offers sameAs as an alternative for author disambiguation. schema.org's ratified sameAs term is defined as 'URL of a reference Web page that unambiguously indicates the item's identity.' Google states that AI Overviews run on core Search with no special optimization, so these quality signals plausibly reach AI Overview source selection transitively. Audit value is real: a byline plus resolvable Person markup is cheap, standards-conformant, and carries no downside.

**Counter-evidence:** No AI vendor documents author credentials as a citation input. Anthropic's crawler doc (verified) contains zero guidance on content selection — no mention of authorship, credentials, dates, schema or authority. Google's own AI-features doc says 'There are no additional requirements to appear in AI Overviews or AI Mode' and 'There's also no special schema.org structured data that you need to add.' The GEO paper's nearest analogue is the 'Authoritative' rewrite, which scored 21.3 against a 19.3 baseline (+10.4% PAWC). Its authors conclude: 'to the contrary we find no significant improvement, demonstrating that Generative Engines are already somewhat robust to such changes.' The 2026 critical survey states that authority signals, authorship and E-E-A-T credentials among them, are 'not systematically studied', and that authority and credibility effects are 'weak and unstable'. Ahrefs' 75K-brand study measured no author-level variable at all, and Semrush's 5M-cited-URL technical study did not test author markup. Every claim that sameAs-attributed authors 'perform better in AI retrieval' traces to vendor marketing blogs with no published methodology. Grade C, not B: plausible mechanism, real standards adoption, zero controlled evidence of an AI-citation effect.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
