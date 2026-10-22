---
audit: answer-readiness/external-citations
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/external-citations.ts
slug: external-citations
evidence_grade: C
disposition: "kept — informative observation 2026-10-21"
reviewed: 2026-10-21
sources:
  - geo-paper-arxiv
  - geo-paper
  - geo-critical-survey-arxiv
  - google-helpful-content
  - google-ai-features-trust
---

# External content links

> Evidence grade C · informative · weight 0. The audit ID remains unchanged.

## What it checks

Reports distinct HTTP(S) links in visible content on every page type. Site-level navigation, header and footer regions, asides and their equivalent ARIA landmark subtrees do not contribute. Internal links and subdomains of the scan domain do not count. Fragments are removed for deduplication. One observed link is enough for an informative pass; no observed links returns NA because no citation obligation has been established.

## Why it matters

These observations can help a human inspect supporting material. They do not establish a site-wide obligation or predict AI citation quality.

## Evidence

**Grade C for the implemented detector.** The [GEO paper](https://arxiv.org/html/2311.09735v3) studied adding relevant statistics and credible citations in a fixed experimental context (verified 2026-10-21). It did not validate arbitrary link or number counts as a site-quality measure. The old grade B described the study intervention; the current detector does not reproduce that intervention. The previous numeric threshold therefore cannot govern scoring.

## Limits

Links can be commercial, unrelated or inaccurate. The check does not validate source authority, factual support or the destination. It uses the scan domain and its subdomains rather than a complete public-suffix/site-ownership model. It makes no network requests.

## How it scores

This check carries weight 0 and informative display. Pass means an observation exists, not that the site meets a proven quality threshold. No observation returns not applicable. It emits no fail or warning for absent sources or statistics.

## Implementation deviations

- Known share-action URLs do not count as content links: Twitter/X intent and share, Facebook sharer, LinkedIn share, Pinterest pin creation, Reddit submit, WhatsApp (`wa.me`, `api.whatsapp.com/send`) and Telegram share. Normal content URLs on those domains still count. Unknown sharing services may remain undetected.

- The 2026-10-21 correction changes B/scored to C/informative, removes the broad type list and the unsupported count threshold, and corrects the display title. This is a major contract change.
- Runner tests cover every page type, both provenance modes, empty features, mixed samples and unread pages.
- Links in site chrome and in asides are ignored. Site chrome is navigation plus a `<header>` or `<footer>` outside article, aside, main, nav and section (or their explicit ARIA roles), which is the HTML-AAM banner and contentinfo scope. A header or footer inside an article is content: post dates, titles and sources often sit there.

## Deferred

- Scoring requires evidence that validates the implemented feature detector, its population and any threshold. The historical study alone does not supply that proof.

## Historical evidence (2026-08-21)

**Mechanism claim:** Adding citations to external sources in a page's body raises that page's visibility in generative-engine answers, measured as position-adjusted word count and subjective impression, relative to the same page without them.

**Grade: B** — a controlled study reports a measured double-digit delta for exactly this edit, but no engine documents reading outbound citations and the effect is contested at the retrieval stage.

**Evidence:**

- The GEO study's "Cite Sources" method is one of its three top performers on GEO-BENCH. Position-Adjusted Word Count came out at 24.9 against a 19.5 baseline (+27.7%), and Subjective Impression at 21.9 against 19.3 (+13.5%). The paper reports that "Cite Sources performs particularly well for factual queries", because citations provide verification. This is the framework behind the widely-quoted "boost visibility by up to 40% in generative engine responses" headline — https://arxiv.org/abs/2311.09735 (verified 2026-08-21), full results at https://arxiv.org/html/2311.09735v3 (verified 2026-08-21)
- The 2026 critical survey places references in the better-replicated tier: "directly extractable information—figures, definitions, quotations, and references—can facilitate the use of a document" — https://arxiv.org/html/2607.14035v1 (verified 2026-08-21)
- Google's content guidance frames sourcing as a quality signal — "If the content draws on other sources, does it avoid simply copying or rewriting those sources, and instead provide substantial additional value and originality?" — https://developers.google.com/search/docs/fundamentals/creating-helpful-content (verified 2026-08-21)

**Counter-evidence:** The same survey records a direct upstream contradiction: "citation-oriented rewrites can impair retrieval". It cites SAGEO Arena finding that body-only optimization "reduces average top-20 presence by approximately 9%". A page can therefore gain inside the answer while losing its chance to enter the candidate set (https://arxiv.org/html/2607.14035v1, verified 2026-08-21). The GEO measurements are conditional on the page already sitting in a fixed retrieval context, and every winning method in that study adds content, which confounds the citation manipulation with length. Google states there are "no additional requirements to appear in AI Overviews or AI Mode, nor other special optimizations necessary" (https://developers.google.com/search/docs/appearance/ai-features, verified 2026-08-21). Nothing in the evidence supports the audit's "RAG systems cross-reference your citations against their knowledge graph" wording, and no source supports a ≥2-outbound-anchor threshold as the operationalization of "citation".
