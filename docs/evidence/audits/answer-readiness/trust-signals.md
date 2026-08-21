---
audit: answer-readiness/trust-signals
audit_id: "10.7"
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/trust-signals.ts
slug: trust-signals
review_verdict: delete
severity: high
evidence_grade: B
disposition: "kept — rewrite required (approved 2026-08-21)"
reviewed: 2026-08-21
---

# trust-signals (`10.7`)

> generative-engine · source `trust-signals.ts` · review verdict **delete** · evidence grade **B** · disposition: **kept — rewrite required (approved 2026-08-21)**

## What it checks

AI engines scan homepages for trust signals (client logos, testimonials, awards) as authority indicators when deciding whether to recommend your content.

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

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
