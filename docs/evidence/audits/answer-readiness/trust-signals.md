---
audit: answer-readiness/trust-signals
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/trust-signals.ts
slug: trust-signals
evidence_grade: B
disposition: "kept — rebuilt on the GEO-benchmark factors 2026-08-22 (Plan 4, Task 11)"
reviewed: 2026-08-24
recommended_tier: informative
tier_rationale: "Recommended informative on the pre-rebuild evidence. Ships scored on the 2026-08-22 rebuild, which kept only the factors carrying a measurement and dropped the unmeasured comparison factor (contradiction sweep, 2026-08-24)."
consumers:
  - "Google Search human quality raters (documented, calibration only)"
  - none-known as an algorithmic input at any AI engine
signals:
  - name: Review and rating signals (AggregateRating / reviewCount)
    grade: B
    domain: geo-authority
  - name: E-E-A-T applicability to AI engines
    grade: C
    domain: geo-authority
sources:
  - openai-product-feed-spec
  - google-review-snippet-doc
  - google-qrg-2025
  - google-ai-features-trust
  - google-helpful-content
  - geo-paper-arxiv
  - geo-critical-survey-arxiv
  - ahrefs-aio-top10
  - semrush-most-cited-domains
  - anthropic-crawlers
---

# trust-signals (`10.7`)

> answer-readiness · source `trust-signals.ts` · evidence grade **B** · tier **scored** (weight 0.6) · rebuilt from a 12-regex puffery scan onto the factors arXiv 2605.25517 actually measured — see below

## What it checks

Whether the homepage carries the two page-content factors that a 252,000-trial controlled study across six large language models (arXiv 2605.25517) measured as changing which source an answer engine cites. The first is **quantified social proof**: a rating out of five, a review or rating count, or a customer count, always with a number attached. The second is **evidence-backed claims**: at least two outbound citation hosts with readable anchor text, or an explicit `<cite>` or `blockquote[cite]` attribution.

Both must be present to pass; one is a warning and neither is a failure. The homepage may already publish machine-readable review data — Review or AggregateRating JSON-LD carrying an actual rating. The social-proof factor is then handed to `answer-readiness/review-signals`, which owns that fact, and the bar here drops to the remaining factor. Publishing correct markup can therefore never lower the result.

The audit runs only on the homepage, and reports `notApplicable` rather than a verdict when no homepage was scanned or when the page declares a non-English `lang` — the detectors are English-language patterns. It deliberately does not check client logos, testimonials, awards, certification badges or promotional phrasing: those were the v1 patterns, and the same study found promotional tone's effect too small and too inconsistent across models to guide anyone. Comparison content is not scored here either; `answer-readiness/comparison-tables` reports it, unscored.

## Implementation deviations

- The scored factors are the two that arXiv 2605.25517 measured: quantified social proof and evidence-backed claims. Grade B rests on that study alone. The GEO paper's "Authoritative" result found no significant improvement and is not a pillar.
- The tier rests on the measured retrieved-text factors, not on the rating-markup signal block. That block's consumer path belongs to `review-signals`.
- Comparison content is not counted. The study names it only in its practical implications, and `comparison-tables` reports it at grade C. A homepage-only scan therefore reports comparison content nowhere.
- Promotional phrasing, logo grids and badges are not detected. The study found promotional tone too small and inconsistent an effect to guide anyone.
- The social-proof detector needs a number. "Trusted by" alone matches nothing.
- Review or AggregateRating JSON-LD found by `findReviewNodes` (imported from `review-signals`) removes social proof from both the tally and the bar. Adding correct markup never lowers the result, and markup alone stays `warn`.
- The evidence factor ignores social and share hosts, and links with fewer than three characters of anchor text.
- The audit selects the page whose type is `homepage`, not `ctx.pages[0]`.
- The language gate reads the declared `lang` only. A homepage with no `lang` is assessed with the English detectors.
- arXiv 2606.17443 is not used as a detector. Its authority-language effect relied on fabricated claims.
- The coordination with `review-signals` is a deferral, not a merge.
- The weight demotion asked of trust cues is carried by grade B and `defaultPriority: low`. The weight is never hand-set.
- The 2026-08-20 review's call to demote the audit to `informative` is declined. The two remaining factors have a measured, multi-model effect.
- Social proof is not gated to commerce pages. The benchmark ran on generic documents, so the homepage scope is the one its evidence covers.

## Evidence

### Signal: Review and rating signals (AggregateRating / reviewCount) — grade B (geo-authority)

**Mechanism:** Machine-readable review and rating data (ratingValue plus ratingCount/reviewCount, or their product-feed equivalents) on product and commerce pages is ingested by named AI commerce surfaces and by Google rich results, increasing product visibility and selection. Scoped to product/offer/local-business pages only.

**Grade: B** — This is the one authority signal in the domain with a named AI consumer that enumerates the fields: OpenAI's Product Feed Spec for Agentic Commerce documents `review_count`, `star_rating`, `store_review_count` and `store_star_rating`. What holds it at B rather than A is how that consumer receives them: through a pushed merchant feed over an allow-listed endpoint, not by reading on-page markup. An on-page `AggregateRating` is therefore not what feeds ChatGPT shopping, and every rating field in the spec is marked Optional. Google's review snippet is a search-results appearance rather than an AI-answer mechanism.

**Evidence:** This is the one authority signal in the domain with a named AI consumer that explicitly enumerates the fields. OpenAI's Product Feed Spec for Agentic Commerce documents four Optional fields: review_count ('Number of product reviews'), star_rating ('Average review score', 0–5), store_review_count ('Number of brand or store reviews') and store_star_rating. It marks reviews — entries with title, content and ratings — and q_and_a (FAQ pairs) as RECOMMENDED, and brand as REQUIRED. That establishes ChatGPT's shopping surface as a first-class consumer of rating data. Google's review-snippet doc documents AggregateRating for Product, LocalBusiness, Recipe, Course, Event, SoftwareApplication, Book, Movie and Organization, requiring ratingValue plus at least one of ratingCount or reviewCount. Google's Quality Rater Guidelines devote §3.3.2 to 'Customer Reviews as Reputation Information'. For a commerce page, exposing correct rating markup is documented, actionable and low-risk.

**Counter-evidence:** Three important scoping limits. First, OpenAI ingests ratings via a pushed merchant feed over an allow-listed HTTPS endpoint, not by scraping on-page schema. An on-page AggregateRating audit therefore does not actually feed ChatGPT shopping. Every rating field in that spec is also marked Optional. Second, Google's review snippet is a SERP appearance feature. Google's AI-features doc states there is 'no special schema.org structured data that you need to add' for AI Overviews or AI Mode. No documented path from on-page ratings to AI citation exists. Third and most serious for an auditing tool: Google prohibits review structured data 'if the entity that's being reviewed controls the reviews about itself' (LocalBusiness and Organization), plus fake or undisclosed incentivized reviews and reviews aggregated from other sites. An audit that awards points for the mere presence of self-hosted AggregateRating actively pushes sites toward a documented policy violation and a manual action. There is no evidence at all that rating markup affects citation of non-commerce editorial content. Score only on product/offer/local pages, and pair the check with a self-serving-review guard.

### Signal: E-E-A-T applicability to AI engines — grade C (geo-authority)

**Mechanism:** E-E-A-T (Experience, Expertise, Authoritativeness, Trust) functions as a signal that AI answer engines evaluate when selecting which sources to cite, such that improving auditable E-E-A-T proxies (About page, contact info, editorial policy, credentials) raises AI citation probability.

**Grade: C** — The proxies are real and well documented: the Search Quality Rater Guidelines of 11 September 2025 devote whole sections to E-E-A-T and to reputation research. But Google states verbatim that "While E-E-A-T itself isn't a specific ranking factor, using a mix of factors that can identify content with good E-E-A-T is useful". There is no E-E-A-T score to measure, and the guidelines calibrate human raters rather than specify an algorithm. A plausible mechanism with no measurable consumer is grade C, which is why this signal informs the guidance and never the score.

**Evidence:** E-E-A-T is real, well-documented, and worth surfacing as guidance — the auditable proxies map onto genuine Google documentation. The Search Quality Rater Guidelines of 11 September 2025 were verified by direct PDF read. They devote §3.4 to E-E-A-T, §3.3 to reputation of the website and content creators, §5.1 to 'Lacking E-E-A-T', §7.3 to 'High Level of E-E-A-T' and §8.3 to 'Very High Level'. They also cover finding About Us and contact information in §2.5.3, and inadequate information about the website or content creator in §4.5.1 and §5.5. Google's helpful-content doc adds that 'trust is most important' among the four. Since Google states AI Overviews and AI Mode require no optimization beyond core Search, E-E-A-T-aligned quality plausibly reaches AIO source selection transitively. Presenting these as trust hygiene is defensible.

**Counter-evidence:** Decisive against SCORING it. Google states verbatim: 'While E-E-A-T itself isn't a specific ranking factor, using a mix of factors that can identify content with good E-E-A-T is useful'. So there is no E-E-A-T score to measure. The rater guidelines are a human-rater calibration document, not an algorithm specification, and their verified table of contents contains no AI Overviews rating section — contrary to widespread secondary claims. No non-Google engine references E-E-A-T anywhere: Anthropic's crawler documentation contains zero content-selection guidance of any kind. The GEO paper's 'Authoritative' rewrite — the closest experimental analogue — reached only 21.3 vs 19.3 baseline, and the authors state they 'find no significant improvement, demonstrating that Generative Engines are already somewhat robust to such changes.' The 2026 critical survey finds authority signals 'weak and unstable' and warns they 'may conflict with credibility'. Ahrefs shows only 38% of AI Overview citations come from top-10 ranking pages (down from 76% in July 2025), so even Google's own ranking quality is now a weak predictor of AIO citation. Semrush's 100M-citation study shows source selection is dominated by platform-level rebalancing, not page-level trust attributes. Report E-E-A-T proxies as advice; never award or deduct points for an 'E-E-A-T score'.
