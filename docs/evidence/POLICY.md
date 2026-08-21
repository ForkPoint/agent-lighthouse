# Evidence Policy

Agent Lighthouse scores websites on their readiness for AI agents. A wrong audit is worse than no audit: it sends site owners to do work that has no effect, and it erodes trust in every other result. This policy defines what counts as proof, how audits are graded, and what each grade is allowed to do to a score.

## The core rule

**No audit contributes to a score unless its mechanism is proven at grade A or B.**

Every audit must state its mechanism as a falsifiable causal claim — "GPTBot fetches `/llms.txt` before crawling", not "AI systems prefer well-structured sites". Vague claims cannot be proven or refuted, so they cannot be scored.

## Evidence grades

| Grade | Bar | Examples |
| :---- | :-- | :------- |
| **A** | Documented consumer behavior (a vendor doc states that a named agent reads the signal) or a ratified standard with known consumers | RFC 9309 robots.txt parsing; Anthropic documenting that `Claude-User` sends an `Accept` header preferring Markdown |
| **B** | Draft standard with meaningful adoption, or strong empirical evidence of effect | GEO paper citation-rate deltas; MCP authorization via RFC 9728 discovery |
| **C** | Community convention with partial adoption; plausible but unproven mechanism | `llms.txt` existence (published widely, no documented consumer, Google states Search ignores it) |
| **D** | Speculative or invented; no known consumer, no adoption evidence | `ai-catalog.json`; security headers as "AI trust signals" |

## What grades are allowed to do

| Grade | Scoring tier |
| :---- | :----------- |
| A, B | **Scored** — contributes to the category and overall score |
| C | **Informative** — shown in the report with weight 0 |
| D with an active draft-spec trajectory | **Experimental** — behind a flag, unscored |
| D otherwise | **Rejected** — not shipped; if previously shipped, deprecated with a dated public notice |

## Source requirements

- Every claim cites a source id from [`sources.json`](./sources.json) — one registry, no scattered links.
- Primary sources outrank secondary: vendor docs and spec text over blog posts over social media.
- Every source URL is verified to resolve at research time; the registry records the access date.
- **Counter-evidence is recorded, not hidden.** If Google states it ignores a file, the dossier for that file's audit says so. Credibility comes from showing the evidence against our own checks.
- CI runs a link checker over the registry. A dead link fails the build; a source older than 12 months triggers a re-review flag.

## Re-review cadence

The AI-agent ecosystem changes quarterly. Every audit's dossier carries a `reviewed:` date. An audit whose evidence is older than 12 months, or whose cited standard changes status (ratified, deprecated, abandoned), is re-graded. Downgrades below B remove the audit from scoring in the next minor release.

## Deprecation process

Audits die publicly, not silently:

1. The dossier's status changes to `deprecated`, with the evidence for removal cited.
2. The audit ships one more minor release as informative (weight 0) with a deprecation notice in the report.
3. The next major release removes it. The dossier stays published as the record of why.

## History

- 2026-08-20 — policy adopted. Full review of all 207 v1 audits (11-agent code review + 12-domain evidence research, 400 sources) produced the current grade assignments.
