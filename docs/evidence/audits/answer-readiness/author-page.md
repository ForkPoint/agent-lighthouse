---
audit: answer-readiness/author-page
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/author-page.ts
slug: author-page
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

# author-page (`10.3`)

> generative-engine · source `author-page.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

The v7 runner selects article-purpose pages for this check. A `general` declaration does not establish article purpose. Detection can use Open Graph article metadata or primary article prose without author, date, or Article schema fields. Schema-only evidence remains a hint. Detected matches remain informative; a precise `article` declaration uses the existing audit tier.

AI engines follow author page links to verify credentials and build author expertise profiles. A dedicated author page strengthens E-E-A-T signals.

## Evidence

### Signal: Named author with credentials, author pages, and sameAs identity links — grade C (geo-authority)

**Mechanism:** A page can carry a named human author with stated credentials, a linked author or bio page, and schema.org Person sameAs links to external identity references such as Wikidata, LinkedIn or ORCID. The claim is that such a page is more likely to be selected and cited by AI answer engines than an otherwise-identical page with no byline.

**Evidence:** The identity half of this signal is genuinely documented — just not by any AI engine. Google's Search Quality Rater Guidelines of 11 Sept 2025, verified by direct PDF read, structure Page Quality around content-creator identity. Four sections carry it:

- §2.5.2 'Finding Who is Responsible for the Website and Who Created the Content on the Page'
- §3.3.4 'Reputation of the Content Creators'
- §4.5.1 'Inadequate Information about the Website or Content Creator'
- Google's helpful-content doc states verbatim: 'We strongly encourage adding accurate authorship information, such as bylines to content where readers might expect it'. It then asks: 'Do pages carry a byline, where one might be expected?'. Google's Article structured-data doc documents author.name and author.url. author.url is 'a web page that uniquely identifies the author of the article... an "about me" page, or a bio page'. The doc offers sameAs as an alternative for author disambiguation. schema.org's ratified sameAs term is defined as 'URL of a reference Web page that unambiguously indicates the item's identity.' Google states that AI Overviews run on core Search with no special optimization, so these quality signals plausibly reach AI Overview source selection transitively. Audit value is real: a byline plus resolvable Person markup is cheap, standards-conformant, and carries no downside.

**Counter-evidence:** No AI vendor documents author credentials as a citation input. Anthropic's crawler doc (verified) contains zero guidance on content selection — no mention of authorship, credentials, dates, schema or authority. Google's own AI-features doc says 'There are no additional requirements to appear in AI Overviews or AI Mode' and 'There's also no special schema.org structured data that you need to add.' The GEO paper's nearest analogue is the 'Authoritative' rewrite, which scored 21.3 against a 19.3 baseline (+10.4% PAWC). Its authors conclude: 'to the contrary we find no significant improvement, demonstrating that Generative Engines are already somewhat robust to such changes.' The 2026 critical survey states that authority signals, authorship and E-E-A-T credentials among them, are 'not systematically studied', and that authority and credibility effects are 'weak and unstable'. Ahrefs' 75K-brand study measured no author-level variable at all, and Semrush's 5M-cited-URL technical study did not test author markup. Every claim that sameAs-attributed authors 'perform better in AI retrieval' traces to vendor marketing blogs with no published methodology. Grade C, not B: plausible mechanism, real standards adoption, zero controlled evidence of an AI-citation effect.
