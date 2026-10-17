---
audit: answer-readiness/site-wide-passage-uniqueness-ratio
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/site-wide-passage-uniqueness-ratio.ts
slug: site-wide-passage-uniqueness-ratio
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - google-consolidate-duplicate-urls
  - google-ai-features-trust
---

# Site-Wide Passage Uniqueness Ratio

> Shipped in v2. Evidence grade **B** · scored tier · partial overlap · implementation: `multi-page`

## What it checks

Crawls the site, extracts main content per page, and computes two passage-level numbers no page-level tool produces. The first is the fraction of each page's sentences that are unique to it, against those repeated across three or more sibling pages. The second is MinHash near-duplicate clusters at Jaccard >= 0.9, with the canonical status of every cluster member. Includes a divergence sub-check comparing each page against its llms-full.txt or .md alternate.

## Claimed mechanism (falsifiable)

Google clusters duplicate and near-duplicate URLs and elects a single canonical; the losers have their signals consolidated into the winner and are deprioritized (S9) — and AI Overviews eligibility requires being indexed and snippet-eligible in the first place (S4). Separately, near-duplicate saturation is the documented default state of web corpora (S6). Two mechanisms follow. First, a cluster of self-canonicalizing near-duplicate pages competes against itself: at most one member survives canonical election, so the rest are unciteable no matter how good they are. Second, a page whose sentences are mostly site-wide boilerplate produces chunks whose embeddings encode the template rather than the page, so all those pages collide in vector space and none is a distinctive match for any query. Falsifiable at the cluster level: near-duplicate members that self-canonicalize should show markedly lower citation and impression rates than the elected canonical.

## Evidence

The proposal's evidence block was mis-pasted: it carried the RFC 9728 and MCP
tools sources of a different proposal, none of which touch duplication or
canonical election. It is replaced here by the sources this audit's mechanism
actually rests on.

- **[Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)** — Google Search Central (documentation, carried over from the canonical-URL research, URL verified 2026-08-21)
  - Google selects one canonical URL per duplicate cluster, and consolidates the signals of the other members onto it. "It helps search engines to be able to consolidate the signals they have for the individual URLs (such as links to them) into a single, preferred URL." Google may pick a canonical other than the declared one. This is the half of the mechanism this audit tests directly — a cluster whose members all self-canonicalize gives the election no answer, and only one member stays eligible to be shown.
- **[AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)** — Google Search Central (documentation, carried over from the answer-block research, URL verified 2026-08-21)
  - AI Overviews and AI Mode draw on pages that are indexed and snippet-eligible. A cluster member that loses canonical election is not the indexed URL, so however well written it is, it is not the page a generative surface can cite.

**Not carried over.** The proposal's second mechanism — that a page made mostly
of site-wide sentences produces chunk embeddings encoding the template rather
than the page — is stated in the dossier as reasoning about how embeddings work,
not as a cited finding, and no source in this repo measures it. The audit still
reports `uniqueFraction`, and the reasoning is the argument for the number, but
it is unproven and the grade rests on the canonical-election half.

## Example failure

A location-directory site publishes 400 'Service in {City}' pages that are byte-identical except the city name in the h1 and one sentence. uniqueFraction is 0.04; MinHash puts all 400 in one cluster; every page self-canonicalizes. Google elects one, the other 399 are consolidated away, and every chunk embedding from the set is dominated by the shared template, so none is a distinctive vector match for any city-specific query.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Implementation deviations

- A sentence is boilerplate when it appears on at least `max(3, ceil(5% of pages))` pages.
- No MinHash. A crawl sample is tens of pages, so exact pairwise Jaccard over five-gram shingles is cheaper and not an estimate. Clusters form by single-link agglomeration over pairs at Jaccard 0.90 or above.
- No divergence check against `.md` alternates or `llms-full.txt`. `content-extraction/markdown-alternate` already measures that fidelity.
- A cluster resolved by `rel="canonical"` is reported but does not fail. A page with no canonical link names itself.
- An unresolved cluster fails. A median page below 30% unique sentences fails. Individual pages below 30% warn while the median holds. These bands are this implementation's own.

## Deferred

- hreflang and sitemap membership are not joined into clusters.
- The report names pages, not the shared sentences.
