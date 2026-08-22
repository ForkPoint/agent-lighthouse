---
audit: access-crawl-control/ai-bot-directives
audit_id: "2.9–2.13"
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/ai-bot-directives.ts
slug: ai-bot-directives
review_verdict: consolidate
severity: medium
evidence_grade: B
disposition: "consolidated 2026-08-22 (Plan 4, Task 2)"
reviewed: 2026-08-22
---

# ai-bot-directives (`2.9`–`2.13`)

> crawler-permissions · source `ai-bot-directives.ts` · consolidates bytespider (2.9), cohere-ai (2.10), youbot (2.11), diffbot (2.12), ai2bot (2.13) · evidence grade **B** · tier **scored** (weight 0.6)

## Mechanism claim

**Falsifiable claim:** For AI bots whose operator publishes crawler documentation naming the product token — YouBot (You.com) and AI2Bot (Allen Institute) — a `User-agent:` group in `robots.txt` is read by that operator and determines whether the site enters that operator's corpus or index. A `Disallow: /` for those tokens therefore closes a documented consumer path; an explicit `Allow: /` keeps it open and pins the policy against a later blanket block.

**Falsifiable the other way:** for the three remaining tokens (Bytespider, cohere-ai, Diffbot) no such documented reader could be located, and for Bytespider the directive is measured being ignored. Those rows are therefore reported but never scored — blocking them is a legitimate operational choice with no measurable AI-answer cost.

This is the whole reason the five v1 audits collapse into one. Each shipped as a standalone check at weight 1.0, equal to GPTBot, so a site that deliberately blocked a commercial scraper lost as much score as one that blocked the largest AI platform. The consolidated audit parses `robots.txt` once, prints all five stances as an informational table, and scores only the documented-active pair.

## Grade

**B — the strongest *proven* consumer path among the five.**

The five source dossiers graded: bytespider **C**, cohere-ai **C**, youbot **A**, diffbot **C**, ai2bot **B**. The merged audit is capped at B rather than promoted to A on the strength of youbot's stamp, because that A was awarded for *documentation quality* and the same dossier records field measurement directly refuting the documented behaviour (TollBit H1 2026: YouBot "accessed disallowed pages on nearly half of the European sites that had explicitly listed them"). Under [POLICY.md](../../POLICY.md) grade A requires documented consumer *behaviour*; a compliance claim contradicted by measurement is documented but not proven. AI2Bot's B — vendor-published user-agent, named downstream corpus (Dolma), capped only because the AI2 page offers UA filtering rather than an explicit robots.txt commitment — is the highest grade the evidence proves, so B is the merged grade and `weightForGrade('B', 'scored')` = 0.6 the weight.

Note the internal consistency this restores — and note that the two cases are *not* symmetric. The *same* TollBit finding capped Bytespider at C ("the consumer exists but the mechanism is empirically unreliable") while YouBot kept an A, so one of the two stamps had to move; but only YouBot's needed to, and only by one step. Bytespider's C rests on **two** negatives: no vendor documentation of any kind **plus** measured non-compliance. YouBot's demotion rests on **one**: measured non-compliance *despite* vendor documentation that is the most detailed of the five. Documented-but-unreliable is a strictly stronger evidence position than undocumented-and-unreliable, which is exactly why YouBot lands at B rather than being dragged down to Bytespider's C.

That is also the disposition of YouBot inside this audit: **YouBot's own contribution is held at B, not C, and it stays in the scored set** — an unreliable mechanism is still a documented mechanism, so a YouBot directive continues to move the score (a block fails, a wildcard-only allow warns). The cap is therefore a live judgement with a re-review trigger in both directions: if a later measurement round finds YouBot honouring `robots.txt` after all, the A case reopens and this section should be re-litigated; if sustained non-compliance is confirmed instead, YouBot leaves the scored set and the merged grade rests on AI2Bot alone (see counter-evidence below).

## Per-bot evidence

### YouBot — scored · source grade A (documentation), capped at B here

**Mechanism:** Disallowing YouBot removes the site from You.com's real-time search index used to answer user queries.

**Evidence:** You.com publishes a dedicated bot page: UA `Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; YouBot/1.0; +https://docs.you.com/youbot; env:prod) Chrome/X.X.X.X Safari/537.36`; purpose "automatically discovers and indexes web pages to provide real-time, accurate search results"; and an unusually strong compliance claim: "YouBot fully respects robots.txt directives, including user-agent specific rules and crawl-delay settings", with canonical block `User-agent: YouBot / Disallow: /` and robots.txt cached ~30 minutes. Known Agents records 11% of top websites blocking YouBot as of Aug 2026.

**Counter-evidence:** Major contradiction between vendor claim and field measurement (TollBit H1 2026, above). Volume is also small — AI data providers are ~0.4% of all traffic — and the 2026-08-20 code review notes You.com's pivot from consumer answer search to enterprise agent APIs, which shrinks the citation surface further. The audit copy carries the contradiction rather than repeating the vendor claim at face value.

**Sources:** [YouBot — You.com documentation](https://you.com/docs/youbot) · [YouBot — Known Agents](https://knownagents.com/agents/youbot) · [15% of AI page fetchers in Europe reached disallowed URLs, TollBit finds](https://ppc.land/15-of-ai-page-fetchers-in-europe-reached-disallowed-urls-tollbit-finds/)

### AI2Bot — scored · grade B

**Mechanism:** Blocking AI2Bot excludes the site from the Allen Institute's open-language-model training corpora (Dolma and successors); the operator publishes the UA specifically so operators can filter it.

**Evidence:** AI2 publishes a dedicated crawler page with UA `Mozilla/5.0 (compatible) AI2Bot (+https://www.allenai.org/crawler)` and states the crawler explores domains "to find web content" that is "used to train open language models", offering the UA string so it "can be used to filter or reject traffic from our crawler if desired". Its corpora (Dolma) are named in the *Consent in Crisis* audit as a major AI training corpus, giving the block real downstream leverage. Known Agents additionally lists a newer AI2Bot-DeepResearchEval assistant-class agent.

**Counter-evidence:** Capped at B — the AI2 page as fetched contains no explicit robots.txt-compliance sentence and no canonical disallow snippet. AI2Bot appears in no Cloudflare Radar top-five breakdown, so volume is very low. Blocking it specifically removes content from open, research-transparent corpora while leaving closed commercial crawlers unaffected — an outcome many publishers would not intend, which is why the audit's guidance frames the directive as a deliberate policy statement rather than a "more allow is better" instruction.

**Sources:** [AI2Bot — Allen Institute for AI crawler](https://allenai.org/crawler) · [Consent in Crisis: The Rapid Decline of the AI Data Commons](https://arxiv.org/abs/2407.14933) · [Known Agents — AI agent user-agent directory (formerly Dark Visitors)](https://knownagents.com/agents)

### Bytespider — informational · grade C

**Mechanism:** A Bytespider disallow is *intended* to stop ByteDance collecting the site for LLM training, but there is no English-language vendor bot documentation and independent measurement shows the directive is frequently ignored, so the block is not a reliable control.

**Evidence:** Bytespider is unambiguously active and high-volume in 2026: Cloudflare Radar placed it in the AI-crawler top five for the Computer & Electronics vertical, and Known Agents records 19% of top websites blocking it as of 2026-08-19, noting "broad, high-volume sweeps that fetch far more pages per visit than a search crawler".

**Counter-evidence:** Two strong negatives. (1) No vendor documentation comparable to OpenAI/Anthropic/Perplexity — the only operator reference is a Chinese-language webmaster portal (zhanzhang.toutiao.com); ByteDance publishes no English bot page, purpose statement or verifiable IP range list. (2) Documented non-compliance (TollBit H1 2026). The v1 audit additionally *recommended allowing it*, so a site that had blocked Bytespider for origin load — a mainstream ops decision — received a high-priority FAIL telling it to undo the block. The consolidated audit never penalises a Bytespider block and advises enforcement at the edge (WAF/rate-limit) rather than via robots.txt.

**Sources:** [Bytespider — Known Agents](https://knownagents.com/agents/bytespider) · [A deeper look at AI crawlers: breaking down traffic by purpose and industry](https://blog.cloudflare.com/ai-crawler-traffic-by-purpose-and-industry/) · [15% of AI page fetchers in Europe reached disallowed URLs, TollBit finds](https://ppc.land/15-of-ai-page-fetchers-in-europe-reached-disallowed-urls-tollbit-finds/)

### cohere-ai — informational · grade C

**Mechanism:** `cohere-training-data-crawler` is a real observed training-data token attributed to Cohere and is expected to honor robots.txt; `cohere-ai` — the token the v1 audit checked — is an undocumented legacy token with no confirmed operator behaviour.

**Evidence:** Known Agents catalogues cohere-training-data-crawler as an AI Data Scraper operated by Cohere ("Downloads website content to include in datasets used for training AI models such as LLMs"), expected to follow robots.txt, with 7% of top websites blocking it as of 2026-08-19.

**Counter-evidence:** No Cohere vendor crawler documentation was locatable — no crawler page, UA reference, IP range list or compliance statement. `cohere-ai` is separately classified as an "Undocumented AI Agent" — "an unconfirmed agent possibly dispatched by Cohere's AI chat products". Cohere does not appear in Cloudflare Radar's named top-five breakdowns, so volume is negligible, and there is no consumer answer surface where a site could be cited. Informational only.

**Sources:** [cohere-training-data-crawler — Known Agents](https://knownagents.com/agents/cohere-training-data-crawler) · [Known Agents — AI agent user-agent directory (formerly Dark Visitors)](https://knownagents.com/agents)

### Diffbot — informational · grade C

**Mechanism:** Diffbot crawls sites to resell structured extractions to third-party AI systems; a disallow is expected to be honored but is not backed by a locatable vendor compliance statement.

**Evidence:** Known Agents types Diffbot as an AI Data Provider — "Crawls websites to supply structured content to AI systems as a third-party service" — with UA `Mozilla/5.0 (compatible; Diffbot/1.0; +https://diffbot.com)` and a notably high 14% top-website blocking rate as of Aug 2026, indicating real, recognized field presence. As a data broker it is a second-order AI exposure: blocking the named AI crawlers while allowing Diffbot can still route content into AI systems.

**Counter-evidence:** No vendor documentation was reachable (docs.diffbot.com's crawler guide 301s to diffbot.com/docs/). Diffbot does not appear in Cloudflare Radar's named AI-crawler breakdowns, and its crawl product has historically offered customers an option to disregard robots.txt for their own crawls, so token behaviour may vary by job. End users do not query Diffbot and it produces no citations or referral traffic, so blocking it costs nothing in ChatGPT/Claude/Gemini/Perplexity visibility — the v1 audit's high-priority FAIL for blocking it was net-misleading.

**Sources:** [Diffbot — Known Agents](https://knownagents.com/agents/diffbot)

## Counter-evidence for the merged audit

- **The scored pair is low-volume.** Neither YouBot nor AI2Bot appears in a Cloudflare Radar top-five breakdown. The audit scores the *documentedness* of the directive, not traffic, and its weight (0.6, grade B) is priced accordingly — it cannot dominate a category the way five weight-1.0 checks did.
- **YouBot's compliance claim is disputed** (TollBit). If a future re-review confirms sustained non-compliance, YouBot drops out of the scored set and the merged grade falls to B on AI2Bot alone (weight unchanged) — or to C/informative if AI2Bot's evidence also degrades.
- **"Allow" is not universally correct — but the score is not neutral about it either.** Blocking either scored bot is a defensible publisher choice, and the audit says so at medium, never high, priority. What the three states actually mean: an explicit `Allow: /` for YouBot and AI2Bot is the **pass** — the documented consumer path is open and pinned; a bot left to `User-agent: *` is a **warn** — the policy is unstated and flips the day a blanket block lands; an explicit `Disallow: /` for either bot is a **fail** — a documented compliant consumer path is closed, and the audit records that cost rather than hiding it. Stating a block deliberately is more honest than inheriting one, but it does not neutralise the fail: the fail is the recorded price of the choice, not an accusation of a mistake, and the fix text is written so that following it never scores worse than doing nothing.
- **Overlaps** with `access-crawl-control/no-blanket-block` (2.22) and `access-crawl-control/agent-governance` (2.28), both of which read the same file. All three now consume the shared RFC 9309 gatherer, so parsing behaviour (BOM, exact-match, wildcard paths) is fixed in one place.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources) on the five source audits.
- 2026-08-21 — five dossiers generated; REWORK-TODO records the consolidation requirement.
- 2026-08-22 — consolidated into this audit (Plan 4, Task 2). Source dossiers preserved at [`docs/evidence/merged/access-crawl-control/`](../../merged/access-crawl-control/).
