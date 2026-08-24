# Contradiction sweep (stream 6)

**Date:** 2026-08-24
**Scope:** all 215 shipped dossiers under `docs/evidence/audits/`.
**Method:** two mechanical passes over the dossiers' own recorded research, then per-file reading of every hit.

Pass one compares each dossier's `Recommended tier:` lines — written by the evidence research, per signal — against the tier the audit actually ships with. Pass two searches the evidence text for statements that the audit's own pass rule is not what the sources support.

Nothing here is a new judgement about the mechanisms. Every finding is the project's own recorded research disagreeing with what shipped.

## Class A — the audit scores above its own researched recommendation

12 audits. `below/total` counts the researched signals recommending a lower tier than the one that shipped.

| below/total | none-known | grade | tier | weight | audit |
| :--- | :--- | :--- | :--- | ---: | :--- |
| 4/5 | 4 | A | scored | 1.0 | `agent-interfaces/mcp-discovery` |
| 1/1 | 0 | A | scored | 1.0 | `access-crawl-control/chatgpt-user` |
| 1/1 | 1 | A | scored | 1.0 | `agent-interfaces/ai-catalog-exists` |
| 1/2 | 1 | A | scored | 1.0 | `access-crawl-control/anthropic-ai` |
| 1/2 | 0 | A | scored | 1.0 | `content-extraction/markdown-alternate` |
| 1/3 | 0 | A | scored | 1.0 | `machine-discovery/llms-txt-exists` |
| 1/2 | 0 | B | scored | 0.6 | `answer-readiness/trust-signals` |
| 1/2 | 0 | B | scored | 0.6 | `machine-discovery/llms-txt-links-valid` |
| 1/1 | 1 | C | informative | 0 | `machine-discovery/llms-full-txt` |
| 1/2 | 1 | C | informative | 0 | `agent-interfaces/agents-json` |
| 1/2 | 1 | B | experimental | 0 | `agent-interfaces/webmcp-registered-tools` |
| 1/3 | 1 | B | informative | 0 | `operability-safety/security-header-hygiene` |

The first six carry weight 1.0, so each one moves a real site's score.

`agent-interfaces/mcp-discovery` is the clearest. Five signals were researched; four record `Consumers: none-known` and recommend `informative` or `delete`, and one — an RFC 9727 linkset-validation check — recommends `scored`. The composite ships as grade A, weight 1.0. One sound sub-signal is carrying four unsupported ones.

`machine-discovery/llms-txt-exists` deserves particular attention because `POLICY.md` uses llms.txt as its worked example of a grade **C** signal: "published widely, no documented consumer, Google states Search ignores it". It ships grade A, weight 1.0.

## Class B — the pass rule is not what the cited evidence supports

6 audits. Here the grade may be sound; what fails is the rule the audit applies to a site.

| grade | tier | weight | audit |
| :--- | :--- | ---: | :--- |
| A | scored | 1.0 | `access-crawl-control/agent-governance` |
| A | scored | 1.0 | `access-crawl-control/meta-external-agent` |
| A | scored | 1.0 | `agent-interfaces/mcp-discovery` |
| A | scored | 1.0 | `content-extraction/image-alt-text` |
| A | scored | 1.0 | `content-extraction/markdown-alternate` |
| B | scored | 0.6 | `answer-readiness/review-signals` |

### `access-crawl-control/agent-governance`

Its own evidence section states the problem plainly: the grade A "covers the *capability* — separate tokens genuinely receive separate policies. It does not support the audit's pass criterion. No vendor documentation rewards the mere **presence** of granular groups: a bare `User-agent: *` + `Allow: /` grants every named agent identical full access under the RFC 9309 fallback rule, so the current FAIL on that configuration contradicts the cited standard."

The audit failed `gongs-unlimited.com` on 2026-08-24 for exactly that configuration.

### `content-extraction/markdown-alternate`

The evidence grades the mechanism A **for interactive coding agents** and records that the grade does not extend to crawlers or consumer chat: ChatGPT-User takes markdown on 0.1% of fetches; a 14-day controlled test found 0 crawler visits and 0 citations for `.md` files against 137 to matched HTML; Google states markdown is not needed to appear in Search or its AI features. The audit applies the rule to every site regardless of audience. It failed `gongs-unlimited.com`, a retail store with no coding-agent audience.

The pattern in both: the grade was earned for one population, and the pass rule is applied to all of them.

## Proposed disposition

Class A resolves by the policy that already exists — the tier follows the evidence, so each audit drops to the tier its own research recommends, except where a composite audit can be split so the sound signal keeps its grade. `mcp-discovery` is the split case: separate the RFC 9727 linkset validation, which the research recommends scoring, from the four discovery-path checks that have no documented consumer.

Class B needs a rule change per audit, not a tier change. In each case the fix is to narrow the pass condition to what the sources support, and in several cases to gate the audit on page or site type so it stops firing at an audience the evidence never covered.

Both classes must land before the audit pages are published. A page that prints "Consumers: none-known" beside a scored weight of 1.0 refutes itself in the reader's own view.
