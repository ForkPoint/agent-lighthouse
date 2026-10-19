---
audit: access-crawl-control/agent-governance
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/agent-governance.ts
slug: agent-governance
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-10-19
sources:
  - rfc9309
  - s18
  - anthropic-crawlers
  - perplexity-bots-docs
  - google-robots-meta-tag
  - cloudflare-block-ai-bots
  - perplexity-crawlers-doc
  - meta-crawlers
  - amazonbot-docs
  - mistral-robots-docs
  - duckduckgo-duckassistbot
  - youbot-docs
  - allenai-crawler
  - diffbot-robots-txt
  - brave-search-crawler
---

# agent-governance (`2.28`)

> crawler-permissions · source `agent-governance.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Not all AI bots are the same. Training crawlers like GPTBot, CCBot, and Google-Extended scrape your content to build datasets, while conversational and retrieval agents like ChatGPT-User, Claude-User, and OAI-SearchBot fetch pages live to answer real user questions and can send referral traffic back to you. Many sites want to block the former while welcoming the latter — but a single catch-all User-agent: * cannot express that distinction. Granular robots.txt governance names both categories explicitly so each gets the access policy you actually intend.

| State                                                               | Result                     |
| :------------------------------------------------------------------ | :------------------------- |
| no robots.txt                                                       | `na`                       |
| no AI agent named, and the catch-all allows access or there is none | `na` — nothing to separate |
| no AI agent named, and the catch-all blocks the whole site          | `fail`, priority `medium`  |
| both categories named, two of each or with different policies       | `pass`                     |
| only one category named, or too few of each to differ               | `warn`, priority `medium`  |

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** Each major AI vendor operates separate robots.txt product tokens for dataset-training crawling and for live retrieval or search grounding. Per RFC 9309, a crawler obeys the group matching its own token, and falls back to `*` only when no such group exists. A robots.txt that names the two categories separately therefore produces different access outcomes for training and for live retrieval — an outcome a catch-all group alone cannot express.

**Grade: A** — this is a ratified standard (RFC 9309) whose group-matching rule is documented as honored by the named consumers, and OpenAI, Anthropic and Perplexity each publish the training-vs-retrieval token split the audit is built around.

**Evidence:**

- RFC 9309 §2.2.1: "Crawlers MUST use case-insensitive matching to find the group that matches the product token and then obey the rules of the group". If no specific match exists, "crawlers MUST obey the group with a user-agent line with the '*' value, if present". A specific group therefore overrides the catch-all for that agent — the exact capability the audit measures — https://www.rfc-editor.org/rfc/rfc9309.html (verified 2026-08-21)
- OpenAI documents the split directly. **GPTBot** is "used to make our generative AI foundation models more useful and safe", and "Disallowing GPTBot indicates a site's content should not be used in training generative AI foundation models". **OAI-SearchBot** is "used to surface websites in search results in ChatGPT's search features", and "we recommend allowing OAI-SearchBot in your site's robots.txt file". **ChatGPT-User** is user-initiated — https://developers.openai.com/api/docs/bots (verified 2026-08-21)
- Anthropic operates three tokens with distinct purposes — **ClaudeBot** (training-corpus collection), **Claude-User** (user-initiated fetches), **Claude-SearchBot** (search-quality analysis) — and documents per-agent robots.txt groups (`User-agent: ClaudeBot` / `Disallow: /`) — https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler (verified 2026-08-21)
- Perplexity documents the same distinction: **PerplexityBot** is "designed to surface and link websites in search results on Perplexity. It is not used to crawl content for AI foundation models" and respects robots.txt; **Perplexity-User** "Generally ignores robots.txt rules" — https://docs.perplexity.ai/guides/bots (verified 2026-08-21)
- Google's robots meta documentation shows the same category separation on the output side — `nosnippet`/`max-snippet` gate use "as a direct input for AI Overviews and AI Mode" independently of ordinary indexing — https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag (verified 2026-08-21)
- The other vendors whose tokens the audit counts document the same split (all verified 2026-10-19):
  - Perplexity: PerplexityBot "is not used to crawl content for AI foundation models". Perplexity-User "generally ignores robots.txt rules" — https://docs.perplexity.ai/docs/resources/perplexity-crawlers
  - Meta: Meta-ExternalAgent crawls "for use cases such as training foundation AI models". Meta-WebIndexer "navigates the web to improve Meta AI search result quality". Meta-ExternalFetcher "fetches individual links at a user's request" — https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/
  - Amazon: Amazonbot "may be used to train Amazon AI models". Amzn-SearchBot and Amzn-User each "does not crawl content for generative AI model training" — https://developer.amazon.com/amazonbot
  - Mistral: MistralAI-Training builds training datasets. MistralAI-Index content "is not used for generative AI training of any kind". MistralAI-User serves user actions in Vibe — https://docs.mistral.ai/robots
  - DuckDuckGo: DuckAssistBot "crawls pages in real-time for our AI-assisted answers" and "This data is not used in any way to train AI models" — https://duckduckgo.com/duckduckgo-help-pages/results/duckassistbot
  - You.com: "YouBot is the web crawler that powers the You.com search engine" — https://you.com/docs/youbot
  - Allen AI: AI2Bot content "is used to train open language models" — https://allenai.org/crawler
  - Diffbot: "Diffbot does not crawl pages for training generative AI foundation models" — https://www.diffbot.com/docs/crawl/faq/robots-txt
  - Brave: its crawler "does not advertise a differentiated user agent" — https://search.brave.com/help/brave-search-crawler
- Infrastructure has converged on the same taxonomy: Cloudflare's AI bot controls are grouped as **Search**, **Agent** and **Training** categories, confirming the training/realtime split is an operational reality and not a taxonomy this project invented — https://developers.cloudflare.com/bots/additional-configurations/block-ai-bots/ (verified 2026-08-21)

**Counter-evidence:** The A grade covers the _capability_: separate tokens genuinely receive separate policies. It does not reward the mere **presence** of granular groups, and no vendor documentation does. A bare `User-agent: *` with `Allow: /` grants every named agent the same full access under the RFC 9309 fallback rule (https://www.rfc-editor.org/rfc/rfc9309.html, verified 2026-10-17). The audit therefore returns not applicable on an open catch-all, or on a robots.txt that restricts nothing. Only a catch-all blanket block with no named agents fails, because the fallback carries that block onto the live retrieval agents too. Two further limits apply. OpenAI states that for `ChatGPT-User`, "Because these actions are initiated by a user, robots.txt rules may not apply" (https://developers.openai.com/api/docs/bots, verified 2026-10-17). Perplexity states that `Perplexity-User` "generally ignores robots.txt rules" (https://docs.perplexity.ai/guides/bots, verified 2026-10-17). An `Allow: /` group for user-initiated agents is therefore largely a no-op, and the realtime half of the recommended fix carries less weight than the description implies. Vendor propagation delay is also documented (OpenAI: "it can take ~24 hours from a site's robots.txt update for our systems to adjust"), so robots.txt state and observed agent behaviour can legitimately diverge at scan time.

## Implementation deviations

- The verdict with no named AI agents depends on the catch-all, because RFC 9309 §2.2.1 falls back to `*` only when no group names the token.
- An open catch-all, or no restriction at all, is not applicable. Every agent already has the access the named groups would grant.
- A catch-all blanket block with no named agents fails. The fallback carries the block onto the live retrieval agents too.
- A blanket block with a named carve-out for a live agent is differentiation, not a blanket block. A test pins it.
- Both categories named, two of each or with different policies, pass. One category only warns.
- `failureTitle` is "Blanket robots.txt block also shuts out live AI agents", the only case left that fails.
- The two token tables live in `_robots-txt-helpers.ts` and follow the vendor pages above (re-checked 2026-10-19). Training: GPTBot, Google-Extended, ClaudeBot, Applebot-Extended, CCBot, Meta-ExternalAgent, Amazonbot, AI2Bot, MistralAI-Training, plus Bytespider and cohere-ai (see Deferred). Live: ChatGPT-User, OAI-SearchBot, Claude-User, Claude-SearchBot, PerplexityBot, Perplexity-User, Meta-ExternalFetcher, Meta-WebIndexer, Amzn-SearchBot, Amzn-User, DuckAssistBot, MistralAI-User, MistralAI-Index, YouBot.
- Anthropic's row is `ClaudeBot` alone. The legacy `anthropic-ai` token appears in no Anthropic document, so a group naming only it no longer counts as a named training crawler.
- PerplexityBot and YouBot count as live search crawlers, not training crawlers. Diffbot is in neither table. Its operator says the `Diffbot` crawler "is not used for AI training" and describes it as crawling "for building a general search engine", not an AI answer engine. `Diffbot-User` serves "requests originating on behalf of a human user browsing a URL" in Diffbot's own software (https://www.diffbot.com/docs/crawl/faq/robots-txt, verified 2026-10-19).
- `Bravebot` is not counted. Brave documents no distinct user agent for its crawler.
- Mistral states that it "uses specific robots.txt tags" and names the three tokens. Its page gives an explicit disallow instruction only for MistralAI-Training.
- When both categories are named but too thinly to count, the warning says so. It used to say one category had no rules.

## Deferred

- `Bytespider` and `cohere-ai` stay in the training table. No operator page for either was reachable on 2026-10-19 (Cohere's robots.txt page returns 404). Removing them changes counts on sites that name them, so it needs its own review.
- `Google-CloudVertexBot` and `OAI-AdsBot` are documented but fit neither category: one crawls on the site owner's request for Vertex AI Agents, the other validates ad landing pages. They are not counted.
