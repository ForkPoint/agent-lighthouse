---
audit: answer-readiness/meta-description-aeo
audit_id: "9.11"
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/meta-description-aeo.ts
slug: meta-description-aeo
review_verdict: delete
severity: medium
evidence_grade: C
disposition: "proposed: redeem as scored (pending triage)"
reviewed: 2026-08-21
---

# meta-description-aeo (`9.11`)

> answer-engine · source `meta-description-aeo.ts` · review verdict **delete** · evidence grade **C** · disposition: **proposed: redeem as scored (pending triage)**

## What it checks

AI engines use meta descriptions as answer candidates. An action/result formula ("Learn how to X to achieve Y") matches more user queries than generic marketing language.

## Code review findings (2026-08-20, 11-agent pass)

Claims to check whether the meta description follows an 'AEO formula', but the concreteness test is so wide that essentially every non-empty description passes, and the only remaining fail is 'no description at all' — which meta-tags/meta-description (4.1) already covers. The 'action/result formula' it promotes is SEO folklore with no consuming system; the audit then tells users their copy is 'concrete and specific' on the strength of a single capitalized word. A confident quality verdict derived from a meaningless test is worse than not asking the question.

**Required fix:** Delete. Meta-description presence and length are already covered by meta-tags/meta-description (4.1) and unique-meta (4.5). If a quality signal is still wanted, replace it with something falsifiable and per-page — e.g. description length in the 110–160 range, non-duplication across scanned pages, and term overlap with the page's H1/title — and drop the 'AEO formula' framing entirely rather than scoring copy against an unadopted convention.

**False-positive risks:**

- The proper-noun test passes almost anything: `/\S+\s+.*\b[A-Z][a-zA-Z]{2,}/` needs only one capitalized 3+ letter word after the first token. 'Welcome to Acme' passes as 'concrete and specific'. Any second sentence begins with a capital, so any two-sentence description passes automatically.
- German (and any language capitalizing nouns) passes 100% of the time on that same regex — every German meta description is graded 'concrete and specific (named products, materials, or value props)' regardless of content.
- The action/result regex is meaningless: `\b(learn|…|use|try|start)\b.*\b(how|what|…|benefits|features)\b` matches 'Use our features' and reports 'Meta description follows an action/result pattern.'
- `hasNumber = /\d/` means a phone number, a year, or 'Est. 1998' counts as answer-bearing specificity.
- The warn path is nearly unreachable: GENERIC_DOMINATES requires the description to START with discover/explore/shop/… AND contain no period at all (`[^.]*$`). 'Discover our solutions. Trusted by 500 teams.' has a period, so it skips the warn and lands in the catch-all pass.
- Everything else falls into the final `return this.pass('Meta description is present and substantive.')` — so the audit's real semantics are `desc !== ''`, duplicating a presence check the meta-tags category performs.
- Homepage-only: `const page = ctx.pages[0]` judges the site from one page; per-page description quality (the thing that actually matters for answer candidacy) is never examined, and duplicate descriptions across pages are not detected.
- CONCRETE_SIGNAL is a hand-picked apparel/jewelry word list (cotton, merino, cashmere, gold…) — it privileges one vertical and does nothing for SaaS, services, B2B, or non-English copy.
- `page.meta?.['description']` is exact-key; a page emitting only `og:description` (or `Description` normalized differently upstream) is reported as having no meta description at all.

**Test gaps:**

- No German (or any noun-capitalizing) description showing the automatic proper-noun pass.
- No two-sentence description showing that the second sentence's capital letter auto-passes.
- No 'Discover our solutions. Trusted by teams.' case showing the warn path is bypassed by a period.
- No 'Use our features' case showing the action/result regex is trivially satisfiable.
- No multi-page context — per-page and duplicate descriptions are never tested because they are never checked.
- No og:description-only page.
- The existing tests only feed strings hand-built to hit each branch, so the branch structure is verified while the semantics are not.

**Overlaps with:** _none_

## Evidence

### Signal: Meta description quality for AI snippets — grade C (aeo-content)

**Mechanism:** A unique, accurate, human-readable meta description improves the summary an AI answer engine displays or reuses when it surfaces the page as a source, over and above its effect on classic search snippets.

**Evidence:** The classic-search half of this signal is solidly documented: Google states 'Google sometimes uses the meta description HTML element if it might give users a more accurate description of the page than content taken directly from the page', and prescribes auditable properties — 'Create unique descriptions for each page on your site. Identical or similar descriptions on every page of a site aren't helpful', human-readable rather than 'long strings of keywords', and page-specific details like author, date or price. Since AI Overviews and AI Mode inherit the same preview controls (nosnippet, data-nosnippet, max-snippet), the snippet-generation pipeline is at least shared with AI surfaces, giving a plausible path for description text to reach an AI source card.

**Counter-evidence:** The AI-specific half is unproven. No vendor — Google, OpenAI, Anthropic, Perplexity or Microsoft — documents meta description as an input to answer selection or citation. Google states flatly that there are 'no additional requirements to appear in AI Overviews or AI Mode, nor other special optimizations necessary', and that 'You don't need to write in a specific way just for generative AI search.' Zyppy's meta-analysis of ~54 studies did not measure meta description at all. Answer engines synthesize from crawled body text, not from head metadata, and the GEO literature's measured levers are all body-content or context-position levers. The claims circulating that 'meta descriptions often become the snippet that ChatGPT or Bing Chat quote directly' come from SEO vendor blogs with no measurement. Keep the audit, grade it on the documented Google criteria (present, unique, accurate, human-readable, matches page content), and stop claiming an AI mechanism the evidence does not support.
**Consumers:** Google Search snippets (documented: 'Google sometimes uses the meta description HTML element…'), AI answer engines: none-known — no vendor documents meta description as an input to AI answer selection or source-card text · **Recommended tier:** informative

**Sources:** [Control Your Snippets in Search Results](https://developers.google.com/search/docs/appearance/snippet) · [AI Features and Your Website](https://developers.google.com/search/docs/appearance/ai-features) · [Google's Guide to Optimizing for Generative AI Features on Google Search](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) · [AI Citation Ranking Factors Analysis](https://signal.zyppy.com/p/ai-citation-ranking-factors) · [Optimizing Visibility in Generative Engines: A Critical Survey of Generative Engine Optimization (2023–2026)](https://arxiv.org/html/2607.14035v1)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

**Merged into:** `answer-readiness/meta-description` (Plan 4, 2026-08-22) — [merged dossier](../../audits/answer-readiness/meta-description.md)
