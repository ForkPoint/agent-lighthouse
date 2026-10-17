---
audit: answer-readiness/external-citations
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/external-citations.ts
slug: external-citations
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - geo-paper-arxiv
  - geo-paper
  - geo-critical-survey-arxiv
  - google-helpful-content
  - google-ai-features-trust
---

# external-citations (`10.5`)

> generative-engine · source `external-citations.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

The v7 runner includes `article` and `general` pages in this check's existing page population. This preserves coverage when the old catch-all classification becomes unknown. The audit body still owns its existing feature and artifact guards. This scope change does not establish a new consumer path.

Linking to authoritative sources signals expertise. AI RAG systems cross-reference your citations to validate claims and assess content quality.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** Adding citations to external sources in a page's body raises that page's visibility in generative-engine answers, measured as position-adjusted word count and subjective impression, relative to the same page without them.

**Grade: B** — a controlled study reports a measured double-digit delta for exactly this edit, but no engine documents reading outbound citations and the effect is contested at the retrieval stage.

**Evidence:**

- The GEO study's "Cite Sources" method is one of its three top performers on GEO-BENCH. Position-Adjusted Word Count came out at 24.9 against a 19.5 baseline (+27.7%), and Subjective Impression at 21.9 against 19.3 (+13.5%). The paper reports that "Cite Sources performs particularly well for factual queries", because citations provide verification. This is the framework behind the widely-quoted "boost visibility by up to 40% in generative engine responses" headline — https://arxiv.org/abs/2311.09735 (verified 2026-08-21), full results at https://arxiv.org/html/2311.09735v3 (verified 2026-08-21)
- The 2026 critical survey places references in the better-replicated tier: "directly extractable information—figures, definitions, quotations, and references—can facilitate the use of a document" — https://arxiv.org/html/2607.14035v1 (verified 2026-08-21)
- Google's content guidance frames sourcing as a quality signal — "If the content draws on other sources, does it avoid simply copying or rewriting those sources, and instead provide substantial additional value and originality?" — https://developers.google.com/search/docs/fundamentals/creating-helpful-content (verified 2026-08-21)

**Counter-evidence:** The same survey records a direct upstream contradiction: "citation-oriented rewrites can impair retrieval". It cites SAGEO Arena finding that body-only optimization "reduces average top-20 presence by approximately 9%". A page can therefore gain inside the answer while losing its chance to enter the candidate set (https://arxiv.org/html/2607.14035v1, verified 2026-08-21). The GEO measurements are conditional on the page already sitting in a fixed retrieval context, and every winning method in that study adds content, which confounds the citation manipulation with length. Google states there are "no additional requirements to appear in AI Overviews or AI Mode, nor other special optimizations necessary" (https://developers.google.com/search/docs/appearance/ai-features, verified 2026-08-21). Nothing in the evidence supports the audit's "RAG systems cross-reference your citations against their knowledge graph" wording, and no source supports a ≥2-outbound-anchor threshold as the operationalization of "citation".

## Implementation deviations

The page-type list keeps the old general-content population. It is a holding scope, not the final feature gate.
