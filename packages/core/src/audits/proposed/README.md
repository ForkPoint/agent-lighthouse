# Proposed audits — TODO stubs

3 stub files for proposed checks that are researched but not yet shippable.
Every stub compiles, is **not** registered in any category index, and returns
`notApplicable` until implemented. Each file's header carries its
implementation sketch; the full proof lives in
[docs/evidence/proposals](../../../../../docs/evidence/proposals/README.md).

A stub that graduates to a shipped audit is deleted; its bullet leaves the list
below, the count above drops by one, and the audit's id joins `NEW_IN_V2` in
`packages/core/src/tests/new-in-v2.ts`.

Tier per [evidence policy](../../../../../docs/evidence/policy.md): grade A/B → scored, grade C → informative (weight 0).

## Why these have not graduated

All three are blocked on infrastructure the scanner does not have, not on
evidence. None ships in 9.0.0. The 2026-10-19 evidence review
([log](../../../../../docs/evidence/proposals/REVIEW-2026-10-19.md)) re-graded
them and retired a fourth, whose stub was deleted the same day.

- **`agent-operability/overlay-interception-hazard`** needs a headless browser.
  The hazard is an overlay that intercepts a click, which only exists once the
  page renders. A static fetch cannot see it, and the HTML-only browser
  snapshots in `ScanOptions.snapshots` carry no geometry to hit-test.
- **`agentic-commerce/acp-endpoint-conformance-probe`** needs a merchant-issued
  bearer token. ChatGPT always authenticates, so only an authenticated probe
  tests what the consumer sees. The base URL is no longer the blocker: ACP
  2026-04-17 defines `/.well-known/acp.json` with an `api_base_url`. Neither
  `ScanOptions`, the CLI, the MCP tool schema nor the task server's
  `POST /tasks` body carries a credential.
- **`mcp-server-quality/behavior-annotation-coverage-and-claim-consistency`**
  needs a model to judge whether a tool's annotations match its description.
  Its grade rose from C to A: Claude and VS Code decide confirmation prompts
  from `readOnlyHint`, and ChatGPT apps require all three hints. The
  deterministic coverage half graduated on 2026-10-19 as
  `agent-interfaces/mcp-tool-annotation-coverage` (grade A, scored). Only the
  claim-consistency judge stays here.
- **`answer-selection-forensics/question-heading-answer-span-alignment`** was
  retired at grade D and its stub deleted on 2026-10-19. No consumer is
  documented, its thresholds were invented, and the checkable part ships in
  `answer-readiness/text-fragment-addressability` and
  `answer-readiness/question-headings`. Its dossier stays in
  [docs/evidence/proposals](../../../../../docs/evidence/proposals/answer-selection-forensics/question-heading-answer-span-alignment.md)
  as the record of why.

Seven stubs left this folder on 2026-08-22: six tool surveys moved to
[docs/evidence/research](../../../../../docs/evidence/research/README.md)
because their verdict is a market fact identical for every scanned URL, and
`ai-crawler-edge-parity`, which was the same check as
`bot-auth-access/ai-crawler-edge-response-parity` and folded into
[docs/evidence/merged](../../../../../docs/evidence/merged/access-crawl-control/ai-crawler-edge-parity.md).

## agent-operability

- [ ] TODO [`overlay-interception-hazard`](./agent-operability/overlay-interception-hazard.ts) — Overlay Interception Hazard (grade A, scored, `headless-browser`) · [dossier](../../../../../docs/evidence/proposals/agent-operability/overlay-interception-hazard.md)

## agentic-commerce

- [ ] TODO [`acp-endpoint-conformance-probe`](./agentic-commerce/acp-endpoint-conformance-probe.ts) — ACP Endpoint Conformance Probe (grade A for the authenticated tier, informative, `operator-credential`) · [dossier](../../../../../docs/evidence/proposals/agentic-commerce/acp-endpoint-conformance-probe.md)

## mcp-server-quality

- [ ] TODO [`behavior-annotation-coverage-and-claim-consistency`](./mcp-server-quality/behavior-annotation-coverage-and-claim-consistency.ts) — Behavior Annotation Coverage and Claim Consistency (grade A, informative until the judge is measured, `llm-assisted`; the coverage half ships as `agent-interfaces/mcp-tool-annotation-coverage`) · [dossier](../../../../../docs/evidence/proposals/mcp-server-quality/behavior-annotation-coverage-and-claim-consistency.md)
