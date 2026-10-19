# Evidence Policy

Agent Lighthouse scores websites on their readiness for AI agents. A wrong audit is worse than no audit: it sends site owners to do work that has no effect, and it erodes trust in every other result. This policy defines what counts as proof, how audits are graded, and what each grade is allowed to do to a score.

## The core rule

**No audit contributes to a score unless its mechanism is proven at grade A or B.**

Every audit must state its mechanism as a falsifiable causal claim — "GPTBot fetches `/llms.txt` before crawling", not "AI systems prefer well-structured sites". Vague claims cannot be proven or refuted, so they cannot be scored.

A grade licenses the mechanism it was proven for, and nothing wider. If the mechanism is about an artifact's contents — an OpenAPI document's `servers` array, a feed's `lastmod` dates — the grade covers sites that publish that artifact. It says nothing about a site that publishes none, because no vendor documents a consumer for the absence. **An audit about an artifact's contents therefore returns `notApplicable` when the artifact is absent; only a present-and-defective artifact may `fail`.** The grade-C row below records the same reflex from the other side: Chrome Lighthouse scores a missing `llms.txt` as `notApplicable`.

## Evidence grades

| Grade | Bar                                                                                                                                | Examples                                                                                                                                                                                                                                                                        |
| :---- | :--------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A** | Documented consumer behavior (a vendor doc states that a named agent reads the signal) or a ratified standard with known consumers | RFC 9309 robots.txt parsing; Anthropic documenting that `Claude-User` sends an `Accept` header preferring Markdown                                                                                                                                                              |
| **B** | Draft standard with meaningful adoption, or strong empirical evidence of effect                                                    | GEO paper citation-rate deltas; MCP authorization via RFC 9728 discovery                                                                                                                                                                                                        |
| **C** | Community convention with partial adoption; plausible but unproven mechanism                                                       | `llms.txt` existence (published widely; no documented _agent_ consumer — Chrome Lighthouse fetches it as an auditor and scores a missing file `notApplicable`; [Google states Search ignores it](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)) |
| **D** | Speculative or invented; no known consumer, no adoption evidence                                                                   | security headers as "AI trust signals"; `agents.txt`; vendor-invented "AI trust score" meta tags                                                                                                                                                                                |

## What grades are allowed to do

| Grade                                  | Scoring tier                                                                             |
| :------------------------------------- | :--------------------------------------------------------------------------------------- |
| A, B                                   | **Scored** — contributes to the category and overall score                               |
| C                                      | **Informative** — shown in the report with weight 0                                      |
| D with an active draft-spec trajectory | **Experimental** — behind a flag, unscored                                               |
| D, retired or ignored by its consumer  | **Obsolete** — runs by default, weight 0, never fails; tells the owner what to retire    |
| D otherwise                            | **Rejected** — not shipped; if previously shipped, deprecated with a dated public notice |

### Informative or obsolete

Both tiers carry weight 0. They make different claims, so they need different sources.

- **Informative**: the thing is live. No consumer documents reading it yet. The audit may grade it, and may carry a notice of kind `unconsumed` ("no AI vendor reads this").
- **Obsolete**: a consumer withdrew the thing, a vendor documents ignoring it, its spec is dead, or the governing project documents a successor in its place (superseded: the project considered the old location and chose another). The audit carries grade D, because the grade states the strongest proven consumer path and there is none. Its notice, of kind `obsolete`, cites the dated source for the retirement and names the replacement where one exists.

An obsolete audit answers one question: does this site still publish the retired thing? Absent is `notApplicable`. Present is `warn`. It never returns `fail`, because a dead file harms nothing; it only wastes the owner's effort. A "no consumer" finding alone is not enough for the obsolete tier. Calling a live but unread thing "retired" claims more than any source documents.

## Source requirements

- Every claim cites a source id from [`sources.json`](./sources.json) — one registry, no scattered links.
- Primary sources outrank secondary: vendor docs and spec text over blog posts over social media.
- Every source URL is verified to resolve at research time; the registry records the access date.
- **Counter-evidence is recorded, not hidden.** If Google states it ignores a file, the dossier for that file's audit says so. Credibility comes from showing the evidence against our own checks.
- CI runs a link checker over the registry. A dead link fails the build; a source older than the citing audit's review window triggers a re-review flag.

## Re-review cadence

The AI-agent ecosystem changes quarterly. Every audit's dossier carries a `reviewed:` date. An audit whose evidence is older than its grade's review window (A: 12 months; B: 6 months; C and D: 3 months), or whose cited standard changes status (ratified, deprecated, abandoned), is re-graded. Downgrades below B remove the audit from scoring in the next minor release.

## Deprecation process

Audits die publicly, not silently.

When owners may still publish the thing the audit finds, the audit moves to the **obsolete** tier instead of leaving. The report keeps telling them it is retired, which is more use to them than silence. The move is a major release, because the tier and grade change.

When there is nothing to tell an owner (the audit judged a practice, not an artifact, and its evidence fell away):

1. The dossier's status changes to `deprecated`, with the evidence for removal cited.
2. The audit ships one more minor release as informative (weight 0) with a notice of kind `deprecated` in the report.
3. The next major release removes it. The dossier stays published as the record of why.

## History

- 2026-08-20 — policy adopted. Full review of all 207 v1 audits (11-agent code review + 12-domain evidence research, 400 sources) produced the current grade assignments.
- 2026-08-24 — evidence re-sweep on `llms.txt` and `/.well-known/api-catalog`. The grade-C `llms.txt` example was re-verified and holds: no documented agent consumer across 11 vendors, llmstxt.org v2, the IANA Well-Known URIs and Link Relations registries, and the IETF Datatracker; Google Search Central, updated 2026-07-10, still states Search ignores it. **The policy was right and the audits were wrong** — `machine-discovery/llms-txt-exists` (A / scored / 1.0) and `machine-discovery/llms-txt-links-valid` (B / scored / 0.6) were corrected to C / informative / 0 to match this row.
- 2026-08-24 — the grade-**D** example `ai-catalog.json` retired: it is no longer speculative or invented. Since 2026-06-17 it is the file defined by the [Agentic Resource Discovery specification](https://github.com/ards-project/ard-spec) (draft v0.9; Google, Microsoft, Hugging Face and others under a Linux Foundation working group, Apache 2.0), and it has a documented first-party consumer client in [`huggingface/hf-discover`](https://github.com/huggingface/hf-discover), which performs automatic `/.well-known/ai-catalog.json` discovery from a website. Under this table's own bars that is stronger evidence than the grade-C row above it, so keeping it as the canonical grade-D example was false on both halves.
- 2026-08-26 — ARD v0.91 moved the well-known path from `/.well-known/ai-catalog.json` to `/.well-known/ard.json`, with the link relation `rel="ard"` (commit `a305a528`, "spec: publish v0.91"). A consumer MUST fetch `ard.json` and MAY also consult the predecessor path. The MCP Server Card extension still names `ai-catalog.json`, so both paths are live. Neither is in the IANA Well-Known URIs registry (verified 2026-10-18). Recorded on 2026-10-18.
- 2026-08-29 — the core rule gained its population clause: a grade covers sites that publish the artifact its mechanism is about. Four `openapi-*` audits (`openapi-servers`, `openapi-endpoints`, `openapi-schemas`, `openapi-operation-ids` — B / scored / 0.6 each, 2.4 combined) were charging `fail` at high or medium priority to every site with no OpenAPI document at all, on 41 of 41 corpus fixtures. No source documents a consumer that is worse off for the absence, and `openapi-servers`' own recorded counter-evidence argues the opposite for the weaker case. Corrected to `notApplicable` on the absence; every verdict on a document that exists is unchanged.
- 2026-10-18 — the **obsolete** tier added. A consumer-evidence review of the grade C and D file and protocol audits found some that check things their consumer retired or ignores, which site owners still publish. Deleting those audits would leave the owners uninformed. They now move to an obsolete tier at grade D: weight 0, `warn` when the thing is present, never `fail`, with a dated retirement source and a replacement. Live but unread things stay informative with a notice of kind `unconsumed`. The same day, independent review moved `answer-readiness/meta-author` and `access-crawl-control/chatgpt-user` back to informative: Google never supported the author tag, and OpenAI's "may not apply" is a hedge, so neither was withdrawn or documented as ignored. The "superseded" ground was written down for paths a governing project replaced, such as `/.well-known/mcp/servers.json`.
