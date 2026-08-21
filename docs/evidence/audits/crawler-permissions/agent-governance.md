---
audit: crawler-permissions/agent-governance
audit_id: "2.28"
category: crawler-permissions
source_file: packages/core/src/audits/crawler-permissions/agent-governance.ts
slug: agent-governance
review_verdict: fix
severity: high
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# agent-governance (`2.28`)

> crawler-permissions · source `agent-governance.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Not all AI bots are the same. Training crawlers like GPTBot, CCBot, and Google-Extended scrape your content to build datasets, while conversational and retrieval agents like ChatGPT-User, Claude-User, and OAI-SearchBot fetch pages live to answer real user questions and can send referral traffic back to you. Many sites want to block the former while welcoming the latter — but a single catch-all User-agent: * cannot express that distinction. Granular robots.txt governance names both categories explicitly so each gets the access policy you actually intend.

## Code review findings (2026-08-20, 11-agent pass)

The idea is the most genuinely 2026-relevant one in the category — separating training crawlers from realtime conversational fetchers is the distinction publishers actually need — but the implementation inverts the guidance and its pass criterion is numerology. A site with `User-agent: *\nAllow: /` and nothing else is maximally open to every AI agent on the internet, and this audit FAILs it for having 'no AI-agent-specific rules'. An AI-readiness tool marking total openness as a failure is backwards. Symmetrically, `trainingNamed.length >= 2 && realtimeNamed.length >= 2` passes a site that names GPTBot, CCBot, ChatGPT-User and Claude-User all with identical `Allow: /` — expressing exactly zero separation, the thing the audit's own description says a catch-all cannot express. It rewards listing bot names, not governing them.

**Required fix:** Change the failure semantics: a permissive catch-all with no AI-specific rules is `notApplicable` or `pass` (nothing is blocked), never `fail` — reserve failure for genuinely incoherent policies, e.g. realtime agents blocked while training crawlers are allowed, which is the one configuration that is almost always a mistake. Compute `categoryBlocked` per bot and aggregate the per-bot verdicts instead of `flatMap`-merging rules across different agents. Require an actual policy DIFFERENCE for the pass, dropping the `>= 2 && >= 2` count rule entirely. Fix the taxonomy (move PerplexityBot and Amazonbot to realtime). Apply the shared BOM/prefix-matching helper fixes.

**False-positive risks:**
- `if (trainingNamed.length === 0 && realtimeNamed.length === 0)` → `this.fail(...)` on `User-agent: *\nAllow: /` — the most permissive, most AI-friendly robots.txt possible is a FAIL.
- `(trainingNamed.length >= 2 && realtimeNamed.length >= 2)` passes four identical `Allow: /` groups as 'granular agentic governance' though no policy differs. The message even says 'Granular agentic governance' with no differentiation present.
- `categoryBlocked` does `groups.filter(...).flatMap((g) => g.rules)` — merging rules from DIFFERENT bots into one set. `GPTBot: Disallow: /` plus `CCBot: Allow: /` merges to a set containing both, so `isBlanketBlocked` returns false and the training category reads as 'not blocked' though GPTBot is fully blocked. Semantically meaningless across agents.
- `explicitlyNamed` uses `agents.has(name.toLowerCase())` — exact set membership, so `User-agent: CCBot/2.0` or `User-agent: Claude` counts as not-named, understating governance and pushing sites toward the FAIL branch.
- BOM'd or soft-404 robots.txt parses to zero groups → `hasCatchAll` false → FAIL 'robots.txt contains no AI-agent-specific rules' on a file the audit never actually read.
- The taxonomy it depends on is itself wrong: PerplexityBot and Amazonbot sit in `TRAINING_CRAWLERS` though both are realtime/grounding crawlers, so correct real-world configurations are scored against the wrong bucket.
- Heavy in-category duplication: `explicitlyNamed` recomputes exactly the explicit-group presence that audits 2.1–2.21 each already report, so one robots.txt quirk moves 22 checks in the same direction at once.

**Test gaps:**
- No test for the inverted case — `User-agent: *\nAllow: /` alone should not be a FAIL, and the existing test `fails when robots.txt only has a catch-all` actively locks the wrong behavior in.
- No test for four identically-permissive groups passing as 'granular governance'.
- No test exposing the cross-bot rule merge in `categoryBlocked` (GPTBot blocked + CCBot allowed).
- No versioned-token (`CCBot/2.0`) or family-prefix (`Claude`) case.
- No BOM or soft-404 fixture.
- No test asserting consistency with the per-bot audits 2.1–2.21 on the same fixture.

**Overlaps with:** `2.1`, `2.3`, `2.6`, `2.14`, `2.15`, `2.16`, `2.22`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Graded evidence (2026-08-21)

**Mechanism claim:** Each major AI vendor operates separate robots.txt product tokens for dataset-training crawling and for live retrieval/search grounding, and per RFC 9309 a crawler obeys the group matching its own token and falls back to `*` only when no such group exists — so a robots.txt that names the two categories separately produces different access outcomes for training versus live retrieval, which a catch-all group alone cannot express.

**Grade: A** — this is a ratified standard (RFC 9309) whose group-matching rule is documented as honored by the named consumers, and OpenAI, Anthropic and Perplexity each publish the training-vs-retrieval token split the audit is built around.

**Evidence:**
- RFC 9309 §2.2.1: "Crawlers MUST use case-insensitive matching to find the group that matches the product token and then obey the rules of the group"; if no specific match exists, "crawlers MUST obey the group with a user-agent line with the '*' value, if present". A specific group therefore overrides the catch-all for that agent — the exact capability the audit measures — https://www.rfc-editor.org/rfc/rfc9309.html (verified 2026-08-21)
- OpenAI documents the split directly: **GPTBot** is "used to make our generative AI foundation models more useful and safe" and "Disallowing GPTBot indicates a site's content should not be used in training generative AI foundation models", while **OAI-SearchBot** is "used to surface websites in search results in ChatGPT's search features" and "we recommend allowing OAI-SearchBot in your site's robots.txt file". **ChatGPT-User** is user-initiated — https://developers.openai.com/api/docs/bots (verified 2026-08-21)
- Anthropic operates three tokens with distinct purposes — **ClaudeBot** (training-corpus collection), **Claude-User** (user-initiated fetches), **Claude-SearchBot** (search-quality analysis) — and documents per-agent robots.txt groups (`User-agent: ClaudeBot` / `Disallow: /`) — https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler (verified 2026-08-21)
- Perplexity documents the same distinction: **PerplexityBot** is "designed to surface and link websites in search results on Perplexity. It is not used to crawl content for AI foundation models" and respects robots.txt; **Perplexity-User** "Generally ignores robots.txt rules" — https://docs.perplexity.ai/guides/bots (verified 2026-08-21)
- Google's robots meta documentation shows the same category separation on the output side — `nosnippet`/`max-snippet` gate use "as a direct input for AI Overviews and AI Mode" independently of ordinary indexing — https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag (verified 2026-08-21)
- Infrastructure has converged on the same taxonomy: Cloudflare's AI bot controls are grouped as **Search**, **Agent** and **Training** categories, confirming the training/realtime split is an operational reality and not a taxonomy this project invented — https://developers.cloudflare.com/bots/additional-configurations/block-ai-bots/ (verified 2026-08-21)

**Counter-evidence:** The A grade covers the *capability* — separate tokens genuinely receive separate policies. It does not support the audit's pass criterion. No vendor documentation rewards the mere **presence** of granular groups: a bare `User-agent: *` + `Allow: /` grants every named agent identical full access under the RFC 9309 fallback rule, so the current FAIL on that configuration contradicts the cited standard. Two further limits: OpenAI states that for `ChatGPT-User` "Because these actions are initiated by a user, robots.txt rules may not apply", and Perplexity states `Perplexity-User` "Generally ignores robots.txt rules" — so an `Allow: /` group welcoming user-initiated agents is largely a no-op, and the realtime half of the recommended fix carries less weight than the description implies. Vendor propagation delay is also documented (OpenAI: "it can take ~24 hours from a site's robots.txt update for our systems to adjust"), so robots.txt state and observed agent behavior can legitimately diverge at scan time.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-21 — evidence graded **A** (mechanism research pass); grade covers per-token robots.txt governance, not the `>= 2 && >= 2` pass rule.
