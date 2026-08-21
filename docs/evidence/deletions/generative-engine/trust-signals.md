---
audit: generative-engine/trust-signals
category: generative-engine
status: kept-rewrite
verdict: redeemable
evidence_grade: B
reviewed: 2026-08-21
---

# trust-signals — redeemed — keep with rewrite

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **B**.

## Claimed mechanism (steelmanned)

Steelmanned: when a generative engine has several candidate sources of comparable topical relevance, it must break the tie on perceived credibility. Because LLMs consume the page as text, credibility cues that a human would read visually — customer counts, testimonials, awards, certifications, 'trusted by' strips, review language — enter the model's context as literal tokens and can shift which source gets selected and cited. The falsifiable claim: adding social-proof / trust language to a page measurably increases its probability of being cited by an AI answer engine, all else equal.

## What we searched

With WebSearch exhausted I queried the arXiv API directly for 30 recent GEO/AEO papers sorted by date, then fetched the most relevant in full. The decisive source was arXiv 2605.25517 'What Gets Cited: Competitive GEO in AI Answer Engines' — a controlled RAG testbed with 252,000 trials across six LLMs — where I fetched both the abstract and the HTML full text twice to pull the factor taxonomy, the operational definition of the social-proof and promotional factors, the per-model odds ratios, and the practical-implications section. I cross-checked against the KDD'24 GEO paper's 'Authoritative' method (+17%), the 2023-2026 GEO critical survey (2607.14035) on which levers replicate, arXiv 2606.17443 on authority-style language in LLM product recommendation, and arXiv 2606.20065 on large-scale brand visibility. On the vendor side I checked Google's AI features doc and Google's E-E-A-T guidance for any statement that on-page trust markers are read. I also read the sibling review-signals.ts audit to test for overlap.

## Best evidence found for the audit

Genuinely strong and this one surprised me. arXiv 2605.25517 (252,000 paired trials, six LLMs, controlled RAG testbed) tested 18 content factors and found social proof and evidence-backing are real, statistically significant citation drivers: 'Weaker Social Proof' shifted citation with odds ratios from 2.14 up to >10,000, significant in 4 of 6 models; 'Claims With Evidence' (evidence-backed vs unsupported claims) had OR 2.09 to >10,000, significant in 5 of 6 models; 'Consistent vs Contradictory' OR 2.81. The abstract's own summary: 'Completeness and trust cues add smaller gains', while 'formatting-only edits have little impact'. Independently, the KDD'24 GEO paper measured its 'Authoritative' rewriting method at +17% visibility, and arXiv 2606.17443 found authority-style marketing language moves LLM product recommendations by +0.17 rating points, breaking otherwise total incumbent-brand dominance. So the underlying mechanism — credibility language in the retrieved text changes which source an LLM cites — has direct, quantified, multi-model empirical support.

## Counter-evidence

The mechanism survives; the implementation does not match it. (1) In 2605.25517 'Weaker Social Proof' is operationally defined in Table 1 as 'Fewer or lower ratings/reviews' — ratings and review data, which the sibling audit generative-engine/review-signals.ts already checks via aggregateRating/review markup. None of this audit's regexes ('trusted by', 'award', 'partner', 'certified', 'as seen in', logo grids) were tested. (2) The same paper tested 'Overly Promotional' ('excessively enthusiastic or sales-focused tone') and found it significant in only 3 of 6 models with mixed direction — 'effect size insufficient to establish clear guideline' — with neutral phrasing outperforming promotional phrasing where the effect was significant. Roughly half this audit's patterns are pure promotional puffery ('money-back guarantee', 'free shipping', 'secure checkout', 'sustainable', 'organic', 'handcrafted', 'handmade'), i.e. exactly the tone the study says confers no reliable benefit. (3) The paper's own practical guidance names entirely different levers: 'surface core topic terms early, add explicit price and key specs, include comparisons, keep dates current, and replace hedging with evidence-backed claims', and it ranks the four gatekeepers (topic match, price, recency, list position, all OR >>10,000) as orders of magnitude larger than trust cues. (4) The GEO critical survey (2607.14035) concludes 'generic heuristics transfer poorly' and that only 'topical relevance and context position are the most reproducible levers', warning that 'competition can erode individual gains'. (5) The KDD'24 GEO paper explicitly does not test trust badges. (6) Google's AI features doc states there are no special optimizations for AI Overviews/AI Mode. (7) 2606.17443's authority-language effect was demonstrated with 'fabricated clinical-evidence claims' — it documents a manipulation vulnerability, so citing it as a best-practice recommendation would be advising GEO spam.

## Verdict

**redeemed — keep with rewrite** (grade B)

Grade B: there is strong, quantified, multi-model empirical data that trust and social-proof cues in retrieved page text change which source an AI answer engine cites — 252,000 controlled trials, 4-5 of 6 models significant, plus a +17% 'Authoritative' effect in the KDD'24 GEO benchmark. Per the rubric that makes it redeemable, and unlike the other three audits here it has a real measured mechanism behind it. But it must be re-specified to check what was actually measured rather than what reads well in a marketing deck: keep and strengthen ratings/reviews-based social proof (coordinating with review-signals.ts so they do not double-count), add checks for evidence-backed claims and comparison content, and delete the promotional-puffery patterns ('free shipping', 'secure checkout', 'money-back guarantee', 'sustainable', 'organic', 'handcrafted', 'handmade') since the same study found promotional tone yields no consistent benefit and neutral phrasing wins where significant. Its weight should also be demoted relative to the gatekeeper factors — trust cues are explicitly the 'smaller gains' tier.

## Sources

- **[What Gets Cited: Competitive GEO in AI Answer Engines](https://arxiv.org/abs/2605.25517)** — arXiv (study, URL verified 2026-08-21)
  - 252,000-trial controlled RAG testbed, 18 factors, six LLMs. 'Weaker Social Proof' OR 2.14 to >10,000, significant in 4/6 models; 'Claims With Evidence' OR 2.09 to >10,000, significant in 5/6; 'Overly Promotional' significant in only 3/6 with mixed direction and 'insufficient to establish clear guideline'. Social proof is operationally defined as 'Fewer or lower ratings/reviews'. Gatekeepers (topic match, price, recency, list position) all OR >>10,000 dwarf trust cues. Practical guidance: topic terms early, price and specs, comparisons, current dates, evidence-backed claims replacing hedging.
- **[GEO: Generative Engine Optimization](https://arxiv.org/abs/2311.09735)** — arXiv / KDD 2024 (study, URL verified 2026-08-21)
  - 'Authoritative' rewriting measured at +17% visibility; Quotation Addition +41%, Statistics +33%, Cite Sources +28%, Keyword Stuffing -9%. Scope limited to textual content edits — trust badges, testimonials, awards and logo grids are not tested.
- **[Incumbent Advantage: Brand Bias and Cognitive Manipulation Dynamics in LLM Recommendation Systems](https://arxiv.org/abs/2606.17443)** — arXiv (study, URL verified 2026-08-21)
  - Well-known brands receive a 100% recommendation rate when products are identical; 'authority-style marketing language, including fabricated clinical-evidence claims' breaks that monopoly with a Bias Surplus Value of +0.17 rating points, varying by model (GPT-4o-mini, Claude Sonnet, Gemini 3 Flash). Framed as a manipulation/bias vulnerability, not a best practice.
- **[Optimizing Visibility in Generative Engines: A Critical Survey of Generative Engine Optimization (2023-2026)](https://arxiv.org/abs/2607.14035)** — arXiv (study, URL verified 2026-08-21)
  - Finds 'topical relevance and context position are the most reproducible levers'; warns 'generic heuristics transfer poorly', 'competition can erode individual gains', and 'citation-oriented rewrites can impair retrieval'. GEO gains are conditional on a source already being in context and 'establish neither organic discoverability nor durable traffic effects'.
- **[Generative Engine Optimization at Scale: Measuring Brand Visibility Across AI Search Engines](https://arxiv.org/abs/2606.20065)** — arXiv (study, URL verified 2026-08-21)
  - About 78% of citations go to corporate websites; ranked 'best-of' listicles are the most-cited format at ~21% of citations; visibility tracks brand stature (73% for household names, 44% mid-market, 11% niche). No on-site trust-badge or credential signal is identified as a correlate.
- **[AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)** — Google Search Central (vendor-doc, URL verified 2026-08-21)
  - No special optimization or additional technical requirement for AI Overviews/AI Mode beyond standard indexability and snippet eligibility; no mention of on-page trust signals.

## Review history

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **kept-rewrite** (kept, rewrite required per dossier).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.
