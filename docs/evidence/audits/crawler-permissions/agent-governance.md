---
audit: crawler-permissions/agent-governance
audit_id: "2.28"
category: crawler-permissions
source_file: packages/core/src/audits/crawler-permissions/agent-governance.ts
slug: agent-governance
review_verdict: fix
severity: high
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# agent-governance (`2.28`)

> crawler-permissions · source `agent-governance.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

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

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
