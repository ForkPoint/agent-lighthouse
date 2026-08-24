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
---


# Site-Wide Passage Uniqueness Ratio

> Shipped in v2. Evidence grade **B** · scored tier · partial overlap · implementation: `multi-page`

## What it checks

Crawls the site, extracts main content per page, and computes two passage-level numbers no page-level tool produces: the fraction of each page's sentences that are unique to it (versus repeated across three or more sibling pages), and MinHash near-duplicate clusters at Jaccard >= 0.9 with the canonical status of every cluster member. Includes a divergence sub-check comparing each page against its llms-full.txt or .md alternate.

## Claimed mechanism (falsifiable)

Google clusters duplicate and near-duplicate URLs and elects a single canonical; the losers have their signals consolidated into the winner and are deprioritized (S9) — and AI Overviews eligibility requires being indexed and snippet-eligible in the first place (S4). Separately, near-duplicate saturation is the documented default state of web corpora (S6). Two mechanisms follow. First, a cluster of self-canonicalizing near-duplicate pages competes against itself: at most one member survives canonical election, so the rest are unciteable no matter how good they are. Second, a page whose sentences are mostly site-wide boilerplate produces chunks whose embeddings encode the template rather than the page, so all those pages collide in vector space and none is a distinctive match for any query. Falsifiable at the cluster level: near-duplicate members that self-canonicalize should show markedly lower citation and impression rates than the elected canonical.

## Evidence

The proposal's evidence block was mis-pasted: it carried the RFC 9728 and MCP
tools sources of a different proposal, none of which touch duplication or
canonical election. It is replaced here by the sources this audit's mechanism
actually rests on.

- **[Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)** — Google Search Central (documentation, carried over from the canonical-URL research, URL verified 2026-08-21)
  - Google selects one canonical URL per duplicate cluster and consolidates the signals of the other members onto it: "It helps search engines to be able to consolidate the signals they have for the individual URLs (such as links to them) into a single, preferred URL." Google may pick a canonical other than the declared one. This is the half of the mechanism this audit tests directly — a cluster whose members all self-canonicalize gives the election no answer, and only one member stays eligible to be shown.
- **[AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)** — Google Search Central (documentation, carried over from the answer-block research, URL verified 2026-08-21)
  - AI Overviews and AI Mode draw on pages that are indexed and snippet-eligible. A cluster member that loses canonical election is not the indexed URL, so however well written it is, it is not the page a generative surface can cite.

**Not carried over.** The proposal's second mechanism — that a page made mostly
of site-wide sentences produces chunk embeddings encoding the template rather
than the page — is stated in the dossier as reasoning about how embeddings work,
not as a cited finding, and no source in this repo measures it. The audit still
reports `uniqueFraction`, and the reasoning is the argument for the number, but
it is unproven and the grade rests on the canonical-election half.

## Competitor coverage

Screaming Frog and Sitebulb ship exact-duplicate and near-duplicate page detection with a similarity threshold — genuine overlap on the page-level clustering half. Neither computes the per-page unique-passage fraction (the metric that predicts chunk-embedding collapse), neither cross-references cluster membership against canonical/hreflang status to identify self-competing clusters, and neither checks HTML-versus-markdown-alternate divergence. Lighthouse ships none of this.

## Implementation sketch

Multi-page crawl (cap N, seed from sitemap.xml plus llms.txt links). Per page: extract main content, sentence-split, normalize (lowercase, collapse whitespace, strip punctuation). 1) Build a site-wide sentence-frequency map; boilerplate = sentences appearing on >= max(3, 5% of crawled pages). 2) uniqueFraction(page) = unique sentence characters / total sentence characters; flag pages below 0.30. 3) Page-level 5-gram shingles -> 128-permutation MinHash -> LSH banding -> clusters at estimated Jaccard >= 0.90. 4) For each cluster, join in rel=canonical target, hreflang cluster membership, and sitemap presence; the hard fail is a cluster whose members all self-canonicalize, since exactly one will survive Google's election (S9) and the others are wasted. 5) Divergence sub-check: for each page with a .md alternate or an llms-full.txt section, compute Jaccard between the two; 0.50-0.90 means the alternate has drifted stale and the site is serving models a different answer than it serves users — report the diverged sentences. 6) Report medianUniqueFraction as the site-level number and the three worst clusters as the actionable list.

## Example failure

A location-directory site publishes 400 'Service in {City}' pages that are byte-identical except the city name in the h1 and one sentence. uniqueFraction is 0.04; MinHash puts all 400 in one cluster; every page self-canonicalizes. Google elects one, the other 399 are consolidated away, and every chunk embedding from the set is dominated by the shared template, so none is a distinctive vector match for any city-specific query.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

Sentence-level boilerplate, `uniqueFraction`, the five-gram near-duplicate
clustering, the canonical join and `medianUniqueFraction` with the three worst
clusters all ship as the proposal specifies. The boilerplate threshold is
`max(3, ceil(5% of pages))` verbatim, and the tests pin both sides of it.

Two deviations.

**No MinHash.** The sketch specifies 128-permutation MinHash with LSH banding.
That machinery exists to make near-duplicate detection affordable across
millions of documents. A crawl sample is tens of pages, where exact pairwise
Jaccard over five-gram shingles is both cheaper than building the signatures and
not an estimate. Clusters are formed by single-link agglomeration over pairs at
Jaccard 0.90 or above.

**No divergence sub-check.** The sketch's step 5 compares each page against its
`.md` alternate or its `llms-full.txt` section. `content-extraction/markdown-alternate`
already fetches the alternate and measures its fidelity against the HTML, and a
second audit fetching the same files to compute a second overlap number would
report the same defect twice under two names.

A cluster resolved by `rel="canonical"` — one member pointing at another — is
reported but is not a failure: the election has an answer, which is the whole
remedy. A page with no canonical link counts as naming itself, because that is
what a missing canonical means to the crawler.

Status bands are this implementation's: an unresolved cluster fails, a median
page below 30% unique sentences fails, and individual pages below 30% warn while
the median holds. The proposal specifies the measurements and the 0.30 flag, not
the bands.

## Deferred

- **hreflang and sitemap membership.** The sketch joins both into each cluster.
  A translated page pair is a legitimate near-duplicate only under
  normalization this audit does not do, and sitemap presence changes the
  remedy, not whether the cluster is self-competing.
- **Naming the shared sentences.** The report counts boilerplate sentences and
  names the pages, not the sentences themselves. The sentence list is long and
  the actionable unit is the page.
