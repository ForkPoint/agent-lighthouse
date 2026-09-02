---
audit: access-crawl-control/ai-bot-directives
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/ai-bot-directives.ts
slug: ai-bot-directives
evidence_grade: B
disposition: "consolidated 2026-08-22 (Plan 4, Task 2)"
reviewed: 2026-08-22
sources:
  - youbot-docs
  - knownagents-youbot
  - tollbit-robots-noncompliance
  - allenai-crawler
  - consent-in-crisis-arxiv
  - knownagents-directory
  - knownagents-bytespider
  - cloudflare-ai-crawler-purpose-industry
  - knownagents-cohere-training-crawler
  - knownagents-diffbot
---

# ai-bot-directives (`2.9`–`2.13`)

> crawler-permissions · source `ai-bot-directives.ts` · consolidates bytespider (2.9), cohere-ai (2.10), youbot (2.11), diffbot (2.12), ai2bot (2.13) · evidence grade **B** · tier **scored** (weight 0.6)

## What it checks

Your robots.txt stance on five long-tail AI bot tokens, reported in one place.
Two of them affect the result — **YouBot** (You.com) and **AI2Bot** (Allen
Institute) — because only those two have an operator who publishes crawler
documentation naming the token, which is what makes the directive readable by
anyone.

For those two, an explicit `User-agent` group with `Allow: /` passes: it keeps a
documented consumer path open and pins the policy against a later blanket block.
Leaving them to the catch-all `*` warns, because the policy is unstated and will
flip the day a blanket block is added. An explicit `Disallow: /` is reported as a
failure — a legitimate publisher decision, but one that closes a documented
consumer path, and this check records that cost rather than hiding it.

**Bytespider**, **cohere-ai** and **Diffbot** are listed for information only and
never change the result. Blocking them is a reasonable operational choice that
costs no AI-answer visibility.

## Claimed mechanism (falsifiable)

**Falsifiable claim:** Two AI bots have operators who publish crawler documentation naming the product token: YouBot (You.com) and AI2Bot (Allen Institute). For those, a `User-agent:` group in `robots.txt` is read by the operator. It determines whether the site enters that operator's corpus or index. A `Disallow: /` for those tokens therefore closes a documented consumer path; an explicit `Allow: /` keeps it open and pins the policy against a later blanket block.

**Falsifiable the other way:** for the three remaining tokens (Bytespider, cohere-ai, Diffbot) no such documented reader could be located, and for Bytespider the directive is measured being ignored. Those rows are therefore reported but never scored — blocking them is a legitimate operational choice with no measurable AI-answer cost.

This is the whole reason the five v1 audits collapse into one. Each shipped as a standalone check at weight 1.0, equal to GPTBot, so a site that deliberately blocked a commercial scraper lost as much score as one that blocked the largest AI platform. The consolidated audit parses `robots.txt` once, prints all five stances as an informational table, and scores only the documented-active pair.

## Scoring

**B — the strongest _proven_ consumer path among the five.**

The five source dossiers graded: bytespider **C**, cohere-ai **C**, youbot **A**, diffbot **C**, ai2bot **B**. The merged audit is capped at B rather than promoted to A on the strength of youbot's stamp. That A was awarded for _documentation quality_. The same dossier records field measurement that directly refutes the documented behaviour. TollBit H1 2026 found YouBot "accessed disallowed pages on nearly half of the European sites that had explicitly listed them". Under [policy.md](../../policy.md) grade A requires documented consumer _behaviour_; a compliance claim contradicted by measurement is documented but not proven. AI2Bot earns a B: a vendor-published user-agent, and a named downstream corpus (Dolma), capped only because the AI2 page offers UA filtering rather than an explicit robots.txt commitment. That is the highest grade the evidence proves. B is therefore the merged grade, and `weightForGrade('B', 'scored')` = 0.6 the weight.

Note the internal consistency this restores — and note that the two cases are _not_ symmetric. The _same_ TollBit finding capped Bytespider at C — "the consumer exists but the mechanism is empirically unreliable" — while YouBot kept an A. One of the two stamps had to move. Only YouBot's needed to, and only by one step. Bytespider's C rests on **two** negatives: no vendor documentation of any kind **plus** measured non-compliance. YouBot's demotion rests on **one**: measured non-compliance _despite_ vendor documentation that is the most detailed of the five. Documented-but-unreliable is a strictly stronger evidence position than undocumented-and-unreliable, which is exactly why YouBot lands at B rather than being dragged down to Bytespider's C.

That is also the disposition of YouBot inside this audit. **YouBot's own contribution is held at B, not C, and it stays in the scored set.** An unreliable mechanism is still a documented mechanism. A YouBot directive therefore continues to move the score: a block fails, and a wildcard-only allow warns. The cap is therefore a live judgement, with a re-review trigger in both directions. If a later measurement round finds YouBot honouring `robots.txt` after all, the A case reopens and this section should be re-litigated. If sustained non-compliance is confirmed instead, YouBot leaves the scored set, and the merged grade rests on AI2Bot alone (see counter-evidence below).

## Per-bot evidence

### YouBot — scored · source grade A (documentation), capped at B here

**Mechanism:** Disallowing YouBot removes the site from You.com's real-time search index used to answer user queries.

**Evidence:** You.com publishes a dedicated bot page. It names the UA `Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; YouBot/1.0; +https://docs.you.com/youbot; env:prod) Chrome/X.X.X.X Safari/537.36`, and the purpose: the bot "automatically discovers and indexes web pages to provide real-time, accurate search results". It also makes an unusually strong compliance claim — "YouBot fully respects robots.txt directives, including user-agent specific rules and crawl-delay settings" — and gives the canonical block `User-agent: YouBot / Disallow: /`, with robots.txt cached about 30 minutes. Known Agents records 11% of top websites blocking YouBot as of Aug 2026.

**Counter-evidence:** Major contradiction between vendor claim and field measurement (TollBit H1 2026, above). Volume is also small — AI data providers are ~0.4% of all traffic — and You.com has pivoted from consumer answer search to enterprise agent APIs, which shrinks the citation surface further. The audit copy carries the contradiction rather than repeating the vendor claim at face value.

### AI2Bot — scored · grade B

**Mechanism:** Blocking AI2Bot excludes the site from the Allen Institute's open-language-model training corpora (Dolma and successors); the operator publishes the UA specifically so operators can filter it.

**Evidence:** AI2 publishes a dedicated crawler page with UA `Mozilla/5.0 (compatible) AI2Bot (+https://www.allenai.org/crawler)`. It states that the crawler explores domains "to find web content" that is "used to train open language models". It offers the UA string so that it "can be used to filter or reject traffic from our crawler if desired". Its corpora (Dolma) are named in the _Consent in Crisis_ audit as a major AI training corpus, giving the block real downstream leverage. Known Agents additionally lists a newer AI2Bot-DeepResearchEval assistant-class agent.

**Counter-evidence:** Capped at B — the AI2 page as fetched contains no explicit robots.txt-compliance sentence and no canonical disallow snippet. AI2Bot appears in no Cloudflare Radar top-five breakdown, so volume is very low. Blocking it specifically removes content from open, research-transparent corpora, while leaving closed commercial crawlers unaffected. Many publishers would not intend that outcome. The audit's guidance therefore frames the directive as a deliberate policy statement, not a "more allow is better" instruction.

### Bytespider — informational · grade C

**Mechanism:** A Bytespider disallow is _intended_ to stop ByteDance collecting the site for LLM training, but there is no English-language vendor bot documentation and independent measurement shows the directive is frequently ignored, so the block is not a reliable control.

**Evidence:** Bytespider is unambiguously active and high-volume in 2026. Cloudflare Radar placed it in the AI-crawler top five for the Computer & Electronics vertical. Known Agents records 19% of top websites blocking it as of 2026-08-19, and notes "broad, high-volume sweeps that fetch far more pages per visit than a search crawler".

**Counter-evidence:** Two strong negatives. (1) No vendor documentation comparable to OpenAI/Anthropic/Perplexity — the only operator reference is a Chinese-language webmaster portal (zhanzhang.toutiao.com); ByteDance publishes no English bot page, purpose statement or verifiable IP range list. (2) Documented non-compliance (TollBit H1 2026). The v1 audit additionally _recommended allowing it_, so a site that had blocked Bytespider for origin load — a mainstream ops decision — received a high-priority FAIL telling it to undo the block. The consolidated audit never penalises a Bytespider block and advises enforcement at the edge (WAF/rate-limit) rather than via robots.txt.

### cohere-ai — informational · grade C

**Mechanism:** `cohere-training-data-crawler` is a real observed training-data token attributed to Cohere and is expected to honor robots.txt; `cohere-ai` — the token the v1 audit checked — is an undocumented legacy token with no confirmed operator behaviour.

**Evidence:** Known Agents catalogues cohere-training-data-crawler as an AI Data Scraper operated by Cohere. It "Downloads website content to include in datasets used for training AI models such as LLMs". It is expected to follow robots.txt, and 7% of top websites blocked it as of 2026-08-19.

**Counter-evidence:** No Cohere vendor crawler documentation was locatable — no crawler page, UA reference, IP range list or compliance statement. `cohere-ai` is separately classified as an "Undocumented AI Agent" — "an unconfirmed agent possibly dispatched by Cohere's AI chat products". Cohere does not appear in Cloudflare Radar's named top-five breakdowns, so volume is negligible, and there is no consumer answer surface where a site could be cited. Informational only.

### Diffbot — informational · grade C

**Mechanism:** Diffbot crawls sites to resell structured extractions to third-party AI systems; a disallow is expected to be honored but is not backed by a locatable vendor compliance statement.

**Evidence:** Known Agents types Diffbot as an AI Data Provider: it "Crawls websites to supply structured content to AI systems as a third-party service". The UA is `Mozilla/5.0 (compatible; Diffbot/1.0; +https://diffbot.com)`. Its top-website blocking rate is a notably high 14% as of Aug 2026, which indicates real, recognized field presence. As a data broker it is a second-order AI exposure: blocking the named AI crawlers while allowing Diffbot can still route content into AI systems.

**Counter-evidence:** No vendor documentation was reachable (docs.diffbot.com's crawler guide 301s to diffbot.com/docs/). Diffbot does not appear in Cloudflare Radar's named AI-crawler breakdowns, and its crawl product has historically offered customers an option to disregard robots.txt for their own crawls, so token behaviour may vary by job. End users do not query Diffbot and it produces no citations or referral traffic, so blocking it costs nothing in ChatGPT/Claude/Gemini/Perplexity visibility — the v1 audit's high-priority FAIL for blocking it was net-misleading.

## Counter-evidence for the merged audit

- **The scored pair is low-volume.** Neither YouBot nor AI2Bot appears in a Cloudflare Radar top-five breakdown. The audit scores the _documentedness_ of the directive, not traffic, and its weight (0.6, grade B) is priced accordingly — it cannot dominate a category the way five weight-1.0 checks did.
- **YouBot's compliance claim is disputed** (TollBit). If a future re-review confirms sustained non-compliance, YouBot drops out of the scored set and the merged grade falls to B on AI2Bot alone (weight unchanged) — or to C/informative if AI2Bot's evidence also degrades.
- **"Allow" is not universally correct — but the score is not neutral about it either.** Blocking either scored bot is a defensible publisher choice, and the audit says so at medium, never high, priority. The three states mean this. An explicit `Allow: /` for YouBot and AI2Bot is the **pass**: the documented consumer path is open and pinned. A bot left to `User-agent: *` is a **warn**: the policy is unstated, and it flips the day a blanket block lands. An explicit `Disallow: /` for either bot is a **fail**: a documented compliant consumer path is closed, and the audit records that cost rather than hiding it. Stating a block deliberately is more honest than inheriting one, but it does not neutralise the fail. The fail is the recorded price of the choice, not an accusation of a mistake. The fix text is written so that following it never scores worse than doing nothing.
- **Overlaps** with `access-crawl-control/no-blanket-block` (2.22) and `access-crawl-control/agent-governance` (2.28), both of which read the same file. All three now consume the shared RFC 9309 gatherer, so parsing behaviour (BOM, exact-match, wildcard paths) is fixed in one place.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources) on the five source audits.
- 2026-08-21 — five dossiers generated; REWORK-TODO records the consolidation requirement.
- 2026-08-22 — consolidated into this audit (Plan 4, Task 2). Source dossiers preserved at [`docs/evidence/merged/access-crawl-control/`](../../merged/access-crawl-control/).
