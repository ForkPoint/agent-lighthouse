---
audit: answer-readiness/about-credentials
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/about-credentials.ts
slug: about-credentials
evidence_grade: C
disposition: "informative, weight 0 (approved 2026-08-21)"
reviewed: 2026-08-21
signals:
  - name: an About page identifying who is responsible for the site
    grade: C
    domain: generative-engine
sources:
  - google-quality-rater-guidelines
  - google-organization-structured-data
  - google-helpful-content
  - google-ai-features-trust
  - geo-paper-arxiv
  - igaming-notability
  - s18
---

# about-credentials (`10.4`)

> generative-engine · source `about-credentials.ts` · review verdict **delete** · evidence grade **C** · disposition: **informative, weight 0 (approved 2026-08-21)**

## What it checks

AI engines crawl your about page to build an organizational authority profile. Without an about page containing team credentials, expertise, and experience details, agents cannot assess your organization's authority, reducing your content's trust score in AI-generated recommendations.

## Evidence

### Signal: an About page identifying who is responsible for the site — grade C (generative-engine)

**Mechanism:** Answer engines and the ranking systems feeding them assess who is responsible for a site. The About page is the conventional artifact where that is declared. A site with no page identifying its operator is therefore harder to assess than one that has it.

**Grade: C** — the convention is genuinely near-universal and Google documents raters being sent to it, but no vendor documents a _system_ reading it, and the narrower claim this audit originally scored is refuted rather than merely unproven.

**Evidence:**

- Google's Search Quality Rater Guidelines of 11 September 2025 state, in §2.5.2 "Finding Who is Responsible for the Website…": "Most websites have 'contact us' or 'about us' or 'about' pages that provide information about who owns the site." §3.3 then makes reputation research mandatory — "reputation research is required for all PQ rating tasks" — https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf (verified 2026-08-21)
- Google's Organization structured-data reference recommends placing the markup "on your home page, or a single page that describes your organization, for example the about us page" — https://developers.google.com/search/docs/appearance/structured-data/organization (verified 2026-08-21)

**Counter-evidence:** The vendor document closest to this audit inverts its original rule. The rater guidelines §5.6 warn about "claims of personal experience or expertise that seem overstated or included just to impress website visitors". They instruct that "E-E-A-T assessments should be based on the MC itself, the information you find during reputation research, verifiable credentials, etc, not just website or content creator claims of 'I'm an expert!'". A check that rewarded credential keywords on an About page therefore rewarded exactly what raters are told to discount. Four further limits weigh against it. Google states plainly that "While E-E-A-T itself isn't a specific ranking factor" (https://developers.google.com/search/docs/fundamentals/creating-helpful-content, verified 2026-08-21). Its AI-features page adds that "There are no additional requirements to appear in AI Overviews or AI Mode, nor other special optimizations necessary" (https://developers.google.com/search/docs/appearance/ai-features, verified 2026-08-21). The KDD'24 GEO study is the strongest controlled evidence in this area, and it is explicitly confined to "textual modifications to website content" — it tests neither about pages nor site-level authority (https://arxiv.org/abs/2311.09735, verified 2026-08-21). And a 2026 citation audit finds "a systematic and overwhelming bias towards Earned media (third-party, authoritative sources) over Brand-owned content", about 78% of citations. That is the opposite of a mechanism where self-authored credential text drives trust (https://arxiv.org/abs/2603.12282, verified 2026-08-21). The rater guidelines' own consumer is a human contractor, not an agent parsing the page. OpenAI's, Anthropic's and Perplexity's crawler documents mention neither About pages nor credentials.

## Limits

The audit reads the common about-page paths from the scan's root files first and probes only paths those reads did not answer. A path with no HTTP response, because the request was not sent, timed out or failed in transport, is not assessed. When no about page is found and some path was not assessed, the audit returns not applicable with the causes instead of reporting the page as missing.
