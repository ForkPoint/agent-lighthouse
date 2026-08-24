---
audit: answer-readiness/trust-signals
audit_id: "10.7"
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/trust-signals.ts
slug: trust-signals
review_verdict: delete
severity: high
evidence_grade: B
disposition: "kept — rebuilt on the GEO-benchmark factors 2026-08-22 (Plan 4, Task 11)"
reviewed: 2026-08-24
---

# trust-signals (`10.7`)

> answer-readiness · source `trust-signals.ts` · evidence grade **B** · tier **scored** (weight 0.6) · rebuilt from a 12-regex puffery scan onto the factors arXiv 2605.25517 actually measured — see below

## What it checks

Whether the homepage carries the two page-content factors a 252,000-trial controlled study across six large language models (arXiv 2605.25517) measured as changing which source an answer engine cites: **quantified social proof** — a rating out of five, a review or rating count, or a customer count, always with a number attached — and **evidence-backed claims** — at least two outbound citation hosts with readable anchor text, or an explicit `<cite>` / `blockquote[cite]` attribution.

Both must be present to pass; one is a warning and neither is a failure. When the homepage already publishes machine-readable review data (Review or AggregateRating JSON-LD carrying an actual rating), the social-proof factor is handed to `answer-readiness/review-signals`, which owns that fact, and the bar here drops to the remaining factor so that publishing correct markup can never lower the result.

The audit runs only on the homepage, and reports `notApplicable` rather than a verdict when no homepage was scanned or when the page declares a non-English `lang` — the detectors are English-language patterns. It deliberately does not check client logos, testimonials, awards, certification badges or promotional phrasing: those were the v1 patterns, and the same study found promotional tone's effect too small and too inconsistent across models to guide anyone. Comparison content is not scored here either; `answer-readiness/comparison-tables` reports it, unscored.

## Code review findings (2026-08-20, 11-agent pass)

Falsy and near-constantly PASSING. The claimed mechanism — 'AI engines scan homepages for trust signals and rank you lower without them' — is unsupported folklore, and the regex list is broad enough that ordinary site chrome clears the 2-signal bar on essentially every commercial homepage: `/\bpartner(s|ed|ship)?\b/i` matches a 'Partners' nav item, `/\b(secure checkout|free returns|free shipping)\b/i` matches a shipping banner, `/\bclients\b/i` matches a footer link. An audit that passes almost everything, on a mechanism that does not exist, is pure noise in the report — and on non-English sites it flips to a confidently wrong FAIL.

**Required fix:** Not salvageable as a scored audit. If it must survive: demote to `scoreDisplayMode: 'informative'` so it is score-excluded, scope strictly to `pageType === 'homepage'`, delete the adjective and shipping/returns patterns, require structural evidence (a testimonial block with attribution, a logo grid inside a section whose heading matches a trust phrase, or Review/AggregateRating schema) instead of free-text regex, and gate on the page `lang` until other languages are supported. Otherwise delete.

**False-positive risks:**
- The 12 TRUST_PATTERNS match navigation and legal boilerplate, not trust content. A homepage with a 'Partners' nav link and a 'Free shipping over $50' banner scores 2 signals → PASS 'Found 2 trust signal(s) on homepage', with no testimonials, logos, awards or case studies. This is the modal outcome for e-commerce.
- `/\baward/i` has no trailing boundary, so it matches 'awarded'/'awards' anywhere including legal text; `/\bcertif(ied|icate|ication)\b/i` matches 'SSL certificate' in a security blurb.
- `/\b(sustainable|organic|fair\s+trade|b\s+corp|handcrafted|handmade)\b/i` treats marketing adjectives as trust signals — 'organic' matches an organic-food product name or the phrase 'organic traffic' in a marketing site's own copy.
- English-only. A German, French, Japanese or Spanish homepage with a full testimonial wall, client logo grid and award badges scores 0 and receives 'No trust signals found on the homepage.' — an outright wrong verdict driven only by language.
- The logo-grid heuristic `$('[class*="logo"], [class*="client"], [class*="partner"], [class*="trust"]').find('img')` is case-sensitive and semantic-class-dependent: `class="Logo"`, styled-components or CSS-Modules hashes, or Tailwind-only markup yield 0 → false negative. Conversely `[class*="logo"]` matches the header logo wrapper, and if that wrapper also holds payment icons the count can reach 3 and fabricate an 'image grid (3 logos)' signal.
- `ctx.pages[0]` is assumed to be the homepage. With user-supplied `PageOverride`s it can be any page, yet the verdict text always says 'on the homepage'.
- No `applicablePageTypes` at all, so the audit runs on every scan regardless of what was scanned, and examines only pages[0].
- The `reviews|customer rating|verified buyer` pattern double-counts the same page fact that audit 10.8 scores independently.

**Test gaps:**
- No test with a realistic commercial homepage (nav + shipping banner) demonstrating the trivial 2-signal pass.
- No test for a non-English homepage with abundant real trust content.
- No test for Tailwind/CSS-Modules/styled-components markup where the logo-grid selector finds nothing.
- No test for the header-logo wrapper inflating `imgInGrids`.
- No test where `ctx.pages[0]` is not the homepage.
- Only 5 tests, all with one-sentence hand-written bodies — none resembles real page markup.

**Overlaps with:** `10.4`, `10.8`

## The GEO-benchmark rebuild (Plan 4, Task 11, 2026-08-22)

The [redemption dossier](../../deletions/generative-engine/trust-signals.md) found something the 2026-08-20 review had not: the *mechanism* is real and quantified — arXiv 2605.25517 ran 252,000 paired trials across six LLMs in a controlled RAG testbed and measured which content factors change citation. What it also found is that this audit checked none of them. So the audit is not repaired, it is re-specified against the measured factor list.

**Old pass condition:** ≥2 matches from 12 free-text regexes anywhere in `ctx.pages[0]`'s body, or a `[class*="logo"]`-style container holding ≥3 `<img>`. 1 match warned, 0 failed. In practice a "Partners" nav link plus a "Free shipping over $50" banner passed — the modal outcome for e-commerce — while any non-English homepage failed no matter how much real trust content it carried.

**New pass condition:** on the homepage, at least 2 of the 3 factors the benchmark measured are present.

| Factor | Measured effect | Detected as |
| --- | --- | --- |
| Quantified social proof | "Weaker Social Proof" (defined as *fewer or lower ratings/reviews*), OR 2.14 to >10,000, significant in 4 of 6 models | a rating out of 5, a review/rating count, or a customer/client/user count — always with a magnitude |
| Evidence-backed claims | "Claims With Evidence", OR 2.09 to >10,000, significant in 5 of 6 models; KDD'24 GEO measured Cite Sources at +28% and Statistics at +33% | ≥2 outbound citation hosts with readable anchor text, or non-empty `<cite>` / `blockquote[cite]` |
| Comparison content | named in the paper's practical implications ("include comparisons") | a `<table>` with ≥3 `<th>`, or a heading framed `vs` / `versus` / `compare` / `difference between` / `alternatives to` |

`warn` at exactly 1 factor, `fail` at 0, `notApplicable` when the page cannot be assessed.

*Superseded 2026-08-24: the comparison row was dropped from the scored tally, and the bar is now every remaining factor rather than a majority — `pass` at both measured factors, `warn` at exactly one, `fail` at neither. See the pass-rule correction below.*

### Promotional puffery deleted

Every pattern the redeem note named is gone: `free shipping`, `secure checkout`, `money-back guarantee`, `sustainable`, `organic`, `handcrafted`, `handmade` — plus the rest of the untested list (`trusted by` with no number, `clients`, `partner`, `certified`, `award`, `as seen in`) and the `[class*="logo"]` image-grid heuristic. The same study tested "Overly Promotional" tone and found it significant in only 3 of 6 models with mixed direction, "effect size insufficient to establish clear guideline", with neutral phrasing winning where the effect existed. Two regression tests pin this: a homepage full of puffery fails, and so does the Partners-nav-plus-shipping-banner page that used to pass.

The surviving social-proof detector requires a **number**, because the number is what the study manipulated. "Trusted by" alone matches nothing; "Trusted by 12,000 companies" matches.

### Non-double-counting with review-signals

The redeem note's explicit constraint. Three separate mechanisms enforce it:

- **`answer-readiness/review-signals` keeps ownership of machine-readable review data.** When `findReviewNodes()` — imported from that audit, not reimplemented — finds Review/AggregateRating JSON-LD on the homepage, the social-proof factor is *deferred*: it leaves both the numerator and the denominator here, and the reported evidence names `answer-readiness/review-signals` as the owner. That function is now exported for exactly this purpose, so the two audits cannot drift apart on what review data is.

  **The pass bar moves with the denominator.** `required` is 2 of 3 normally and 1 of 2 when the factor is deferred, and a deferred factor also lifts the floor off `fail` (0 satisfied reports `warn`, not "none found"). Without both, publishing valid `AggregateRating` markup could flip a passing homepage to `warn` and a warning one to `fail` — penalising exactly the signal the redeem note says to keep and strengthen. The rule the logic guarantees is monotonicity: adding correct review markup never lowers the outcome. It also never *raises* it to a pass on its own — markup plus nothing else is `warn` — so the deferral cannot become a second score for a fact `review-signals` already counted. Three tests pin this: the deferral fixture asserts `pass`, a paired with/without-markup fixture asserts the status and score never regress, and a boundary fixture asserts markup-only is `warn` while the same page bare is `fail`.
- **`answer-readiness/external-citations` is scoped to `content` pages**, so the evidence-backed-claims factor, which is homepage-only, never scores the same anchor twice.
- **`answer-readiness/comparison-tables` is scoped to `category`/`product`/`content` pages**, so the comparison factor is uncontested on the homepage.

The evidence factor also deliberately excludes social and share hosts (facebook, twitter/x, instagram, linkedin, youtube, tiktok, pinterest, threads, reddit, medium, substack…) and icon-only links with fewer than 3 characters of anchor text — a footer icon row is chrome, not evidence-backing.

### Scoping and language gate

- `applicablePageTypes: ['homepage']` is added, and `audit()` selects `pageType === 'homepage'` rather than trusting `ctx.pages[0]`. With user-supplied `PageOverride`s, `pages[0]` could be any page while the verdict text still said "on the homepage".
- A homepage declaring a non-English `lang` returns `notApplicable` instead of a confident `fail`. The detectors are English patterns; saying so is honest, failing a German testimonial wall was not.

### Grade decision: stays **B**, tier `scored`, weight 0.6

Source: the [redemption dossier's verdict](../../deletions/generative-engine/trust-signals.md) — "redeemed — keep with rewrite (grade B)" — and the [REWORK-TODO entry](../../../../packages/core/src/audits/REWORK-TODO.md). The grade rests on the 252,000-trial multi-model benchmark plus the KDD'24 GEO paper's +17% "Authoritative" result. It is B rather than A because the consumers are research testbeds, not a named production engine with vendor documentation, and because the same literature warns that "generic heuristics transfer poorly" and that competition erodes individual gains.

On the redeem note's instruction that "its weight should also be demoted relative to the gatekeeper factors — trust cues are explicitly the 'smaller gains' tier": under the §4 weight law that demotion is already expressed by the grade, since `weightForGrade('B', 'scored') = 0.6` against the `1.0` a grade-A gatekeeper carries. The law forbids hand-setting a weight, so the demotion is additionally carried by `defaultPriority`, which moves `medium` → `low`. `scoreDisplayMode` stays `ternary`.

### Rewrite deviations

- **The audit stays `scored`, against the 2026-08-20 review's "not salvageable as a scored audit / demote to `informative`".** That recommendation predates the adversarial redemption pass, which is the approved disposition (2026-08-21) and which found a real measured mechanism. The redeem note asks for re-specification and a relative weight demotion, not a tier change, and neither it nor the REWORK-TODO row names `informative`. Tier assignment is not this task's to invent, so it stays `scored` at grade B.
- **The review-signals coordination is a deferral, not a merge.** Folding the two audits together would be a merge decision, which no dossier authorises.
- **The language gate keys on the declared `lang` attribute only.** A homepage with no `lang` is assessed with the English detectors; adding language detection is out of scope, and `content-extraction/language-attribute` already scores the missing attribute.
- **arXiv 2606.17443 is not used as a detector.** Its authority-language effect was demonstrated with fabricated clinical-evidence claims; the dossier flags it as a manipulation vulnerability, so building a check on it would be advising GEO spam.

## Evidence

### Signal: Review and rating signals (AggregateRating / reviewCount) — grade B (geo-authority)

**Mechanism:** Machine-readable review and rating data (ratingValue plus ratingCount/reviewCount, or their product-feed equivalents) on product and commerce pages is ingested by named AI commerce surfaces and by Google rich results, increasing product visibility and selection. Scoped to product/offer/local-business pages only.

**Evidence:** This is the one authority signal in the domain with a named AI consumer that explicitly enumerates the fields. OpenAI's Product Feed Spec for Agentic Commerce documents review_count ('Number of product reviews'), star_rating ('Average review score', 0–5), store_review_count ('Number of brand or store reviews') and store_star_rating as Optional fields, and marks reviews (entries with title, content, ratings) and q_and_a (FAQ pairs) as RECOMMENDED — establishing that ChatGPT's shopping surface consumes rating data as a first-class input. brand is a REQUIRED field. Google's review-snippet doc documents AggregateRating for Product, LocalBusiness, Recipe, Course, Event, SoftwareApplication, Book, Movie and Organization, requiring ratingValue plus at least one of ratingCount or reviewCount. Google's Quality Rater Guidelines devote §3.3.2 to 'Customer Reviews as Reputation Information'. For a commerce page, exposing correct rating markup is documented, actionable and low-risk.

**Counter-evidence:** Three important scoping limits. First, OpenAI ingests ratings via a pushed merchant FEED over an allow-listed HTTPS endpoint — not by scraping on-page schema — so an on-page AggregateRating audit does not actually feed ChatGPT shopping, and every rating field in that spec is marked Optional. Second, Google's review snippet is a SERP appearance feature; Google's AI-features doc states there is 'no special schema.org structured data that you need to add' for AI Overviews or AI Mode, so no documented path from on-page ratings to AI citation exists. Third and most serious for an auditing tool: Google prohibits review structured data 'if the entity that's being reviewed controls the reviews about itself' (LocalBusiness and Organization), plus fake or undisclosed incentivized reviews and reviews aggregated from other sites. An audit that awards points for the mere presence of self-hosted AggregateRating actively pushes sites toward a documented policy violation and a manual action. There is no evidence at all that rating markup affects citation of non-commerce editorial content. Score only on product/offer/local pages, and pair the check with a self-serving-review guard.
**Consumers:** ChatGPT shopping (documented: OpenAI Product Feed Spec ingests review_count, star_rating, store_review_count, store_star_rating, reviews), Google Search rich results (documented: Review / AggregateRating review snippets) · **Recommended tier:** scored

**Sources:** [Product Feed Spec — Products (Agentic Commerce)](https://developers.openai.com/commerce/specs/file-upload/products) · [Review Snippet (Review, AggregateRating) Structured Data](https://developers.google.com/search/docs/appearance/structured-data/review-snippet) · [Google Search Quality Rater Guidelines (General Guidelines), September 11, 2025](https://guidelines.raterhub.com/searchqualityevaluatorguidelines.pdf) · [AI Features and Your Website](https://developers.google.com/search/docs/appearance/ai-features)

### Signal: E-E-A-T applicability to AI engines — grade C (geo-authority)

**Mechanism:** E-E-A-T (Experience, Expertise, Authoritativeness, Trust) functions as a signal that AI answer engines evaluate when selecting which sources to cite, such that improving auditable E-E-A-T proxies (About page, contact info, editorial policy, credentials) raises AI citation probability.

**Evidence:** E-E-A-T is real, well-documented, and worth surfacing as guidance — the auditable proxies map onto genuine Google documentation. The Search Quality Rater Guidelines of 11 September 2025 (verified by direct PDF read) devote §3.4 to E-E-A-T, §3.3 to reputation of the website and content creators, §5.1 to 'Lacking E-E-A-T', §7.3 to 'High Level of E-E-A-T' and §8.3 to 'Very High Level', alongside §2.5.3 on finding About Us and contact information and §4.5.1/§5.5 on inadequate information about the website or content creator. Google's helpful-content doc adds that 'trust is most important' among the four. Since Google states AI Overviews and AI Mode require no optimization beyond core Search, E-E-A-T-aligned quality plausibly reaches AIO source selection transitively. Presenting these as trust hygiene is defensible.

**Counter-evidence:** Decisive against SCORING it. Google states verbatim: 'While E-E-A-T itself isn't a specific ranking factor, using a mix of factors that can identify content with good E-E-A-T is useful' — there is no E-E-A-T score to measure, and the QRG is a human-rater calibration document, not an algorithm specification (its verified table of contents contains no AI Overviews rating section, contrary to widespread secondary claims). No non-Google engine references E-E-A-T anywhere: Anthropic's crawler documentation contains zero content-selection guidance of any kind. The GEO paper's 'Authoritative' rewrite — the closest experimental analogue — reached only 21.3 vs 19.3 baseline, and the authors state they 'find no significant improvement, demonstrating that Generative Engines are already somewhat robust to such changes.' The 2026 critical survey finds authority signals 'weak and unstable' and warns they 'may conflict with credibility'. Ahrefs shows only 38% of AI Overview citations come from top-10 ranking pages (down from 76% in July 2025), so even Google's own ranking quality is now a weak predictor of AIO citation. Semrush's 100M-citation study shows source selection is dominated by platform-level rebalancing, not page-level trust attributes. Report E-E-A-T proxies as advice; never award or deduct points for an 'E-E-A-T score'.
**Consumers:** Google Search human quality raters (documented, calibration only), none-known as an algorithmic input at any AI engine · **Recommended tier:** informative

**Sources:** [Creating Helpful, Reliable, People-First Content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) · [Google Search Quality Rater Guidelines (General Guidelines), September 11, 2025](https://guidelines.raterhub.com/searchqualityevaluatorguidelines.pdf) · [AI Features and Your Website](https://developers.google.com/search/docs/appearance/ai-features) · [GEO: Generative Engine Optimization (Aggarwal, Murahari, Rajpurohit, Kalyan, Narasimhan, Deshpande)](https://arxiv.org/abs/2311.09735) · [Optimizing Visibility in Generative Engines: A Critical Survey of Generative Engine Optimization (2023–2026)](https://arxiv.org/html/2607.14035v1) · [Update: 38% of AI Overview Citations Pull From The Top 10](https://ahrefs.com/blog/ai-overview-citations-top-10/) · [The Most-Cited Domains in AI: A 3-Month Study](https://www.semrush.com/blog/most-cited-domains-ai/) · [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/generative-engine/trust-signals.md](../../deletions/generative-engine/trust-signals.md). Outcome: **redeemable**, grade B.

## Pass-rule correction (contradiction sweep, 2026-08-24)

The contradiction sweep flagged this audit as a Class A case: one of its two graded evidence signals recommends a lower tier than the one that shipped. Reading the file back, the mechanical count understates the problem. The contradiction is not only in the Evidence section — it is inside the 2026-08-22 rebuild's own factor table.

**What the record supports.** Two of the three rebuilt factors carry a measurement. Quantified social proof is the "Weaker Social Proof" condition of arXiv 2605.25517: OR 2.14 to >10,000, significant in 4 of 6 models. Evidence-backed claims is "Claims With Evidence": OR 2.09 to >10,000, significant in 5 of 6 models, corroborated by the KDD'24 GEO paper's Cite Sources +28% and Statistics +33%. Both are exactly what POLICY's grade-B bar describes — "strong empirical evidence of effect", whose own worked example is "GEO paper citation-rate deltas".

**What it does not support.** The third factor's row in that same table gives, under *Measured effect*, "named in the paper's practical implications ('include comparisons')". That is a sentence in a discussion section: no odds ratio, no significance test, no model count, sitting in a column where the other two rows carry both. The project has already researched that signal on its own terms. `docs/evidence/audits/answer-readiness/comparison-tables.md` records "**Consumers:** none-known — no vendor documents table markup as an answer-selection or citation signal · **Recommended tier:** informative", and that audit ships grade C, tier `informative`, weight 0. The same page fact was therefore being priced at two grades at once — nothing in one audit, and one third of a grade-B scored pass bar in this one.

Under the "2 of 3" rule that mispricing was decisive rather than cosmetic. A homepage with a comparison table and any single measured factor passed. A homepage carrying nothing but a "Compare us to X" heading warned instead of failing. Neither outcome is supported by anything in this dossier.

**The grade paragraph's second pillar is withdrawn.** The 2026-08-22 grade decision reads: "The grade rests on the 252,000-trial multi-model benchmark plus the KDD'24 GEO paper's +17% 'Authoritative' result." The E-E-A-T signal in this dossier's own Evidence section says of that result that the "Authoritative" rewrite "reached only 21.3 vs 19.3 baseline, and the authors state they 'find no significant improvement, demonstrating that Generative Engines are already somewhat robust to such changes.'" That signal records "**Recommended tier:** informative" and "none-known as an algorithmic input at any AI engine". The second pillar was refuted here before it was cited here. Grade B now rests on arXiv 2605.25517 alone — which is enough for the two factors that study measured, and for nothing beyond them.

**Where the scored tier comes from, stated plainly.** Neither of the two graded `Signal:` blocks in the Evidence section below is the warrant for scoring what this audit scores. The rating-markup signal ends "**Recommended tier:** scored", but it governs the machine-readable path — Google's review rich results and OpenAI's product-feed `star_rating`/`review_count` fields — and this audit hands that path to `answer-readiness/review-signals` by deferral rather than scoring it. The E-E-A-T signal recommends `informative` and is not implemented here at all. What this audit scores is the benchmark's retrieved-text factors, which were never written up as a graded signal block, only as the rebuild narrative above. The tier therefore rests directly on arXiv 2605.25517 under POLICY's grade-B bar. Recording that openly is the point of the correction; borrowing a "scored" recommendation that belongs to a different mechanism is what the sweep exists to stop.

**The change.** The comparison factor is removed from the scored tally. `COMPARISON_HEADING`, `comparisonContent()` and the Factor 3 block are deleted from the source, and the pass bar becomes `required = counted` — every factor still in the denominator must be satisfied. `pass` now means both measured factors, `warn` means exactly one, `fail` means neither. The `EXPECTED` string and the failure message move with the rule, and the description, impact and fix guidance now name two measured factors instead of three and say what the study found about promotional tone (measured, effect too small and inconsistent to guide) and about comparison content (named in the practical implications, never measured) rather than collapsing the two into one claim.

The deferral to `answer-readiness/review-signals` is untouched, and with it the monotonicity rule the 2026-08-22 rework established: valid Review/AggregateRating markup still removes social proof from the numerator and the denominator together, so `counted` and `required` both fall to 1 and adding correct markup can never lower a homepage's status or score. Markup alone is still `warn`, never `pass`. All four transitions are pinned by tests, including the social-proof-only corner that the narrower denominator newly touches.

Note for anyone reading the two audits together: `findReviewNodes` was tightened in `review-signals` on the same day, so hollow review vocabulary — `"aggregateRating": {}`, a bare `{"@type":"Review"}` — no longer triggers the deferral. That moves this audit's denominator from 1 back to 2 on such pages, which is the correct direction: a page with the shape of a rating and no rating has published no social proof for either audit to score. A test in this audit's file pins it.

**What deliberately did not change.** Grade stays **B**, tier `scored`, weight `weightForGrade('B', 'scored')` = 0.6, `scoreDisplayMode` `ternary`, `defaultPriority` `low`, `applicablePageTypes: ['homepage']`. The 2026-08-20 review's "not salvageable as a scored audit / demote to `informative`" is declined for the same reason the 2026-08-22 rework declined it: the surviving factors have a real, quantified, multi-model measured effect. Over-narrowing a signal the evidence says to score is as much a defect as scoring one it does not.

**Two alternatives considered and rejected.**

1. *Split the comparison factor into a new informative audit.* Rejected — the split target already exists. `answer-readiness/comparison-tables` is the same signal at the grade and tier its own research assigned, and its `audit()` iterates `ctx.pages` rather than a single matched page, so homepage tables are reported there whenever it runs. A second audit would duplicate it for no evidential gain. One consequence is accepted and recorded here: that audit is gated to `category`/`product`/`content` pages, so on a homepage-only scan comparison content is now reported by nothing. For a signal with no documented consumer that is the right outcome, and widening that audit's page types is its own dossier's decision, not this one's.
2. *Gate the social-proof factor to commerce pages,* following the rating-markup signal's counter-evidence that ratings should "Score only on product/offer/local pages". Rejected — that scope limit is about machine-readable rating markup and its named commerce consumers, which this audit defers away. What is scored here is the benchmark's retrieved-text factor, and 2605.25517 ran on generic RAG documents rather than commerce pages, so the homepage scope is the one its evidence covers.

**What moves for real sites.** A homepage that passed on a comparison table plus one measured factor now warns. A homepage whose only signal was a comparison table or a "X vs Y" heading now fails instead of warning. Homepages that already carried a quantified rating or review count together with outbound citations or attributed sources are unaffected. This audit is a member of the content readiness vital set, so those sites' content readiness figure moves along with the category and overall score.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (grade B, rewrite required).
- 2026-08-22 — required rework executed (Plan 4, Task 11): rebuilt on the three arXiv 2605.25517 factors, promotional-puffery patterns deleted, social proof deferred to `answer-readiness/review-signals` when review markup is present, scoped to the homepage, non-English homepages `na`, `defaultPriority` `medium` → `low`. Grade B / tier `scored` / weight 0.6 unchanged; `TODO(redeem)` marker removed from the source file.
- 2026-08-24 — comparison factor dropped from the scored tally (contradiction sweep); pass now requires both measured factors, `warn` one, `fail` neither. Grade B / tier `scored` / weight 0.6 / `scoreDisplayMode` `ternary` unchanged.
