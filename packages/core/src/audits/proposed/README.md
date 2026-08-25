# Proposed audits — TODO stubs

4 stub files for proposed checks that are researched but not yet shippable.
Every stub compiles, is **not** registered in any category index, and returns
`notApplicable` until implemented. Each file's header carries its
implementation sketch; the full proof lives in
[docs/evidence/proposals](../../../../../docs/evidence/proposals/README.md).

A stub that graduates to a shipped audit is deleted; its bullet leaves the list
below, the count above drops by one, and the audit's id joins `NEW_IN_V2` in
`packages/core/src/tests/new-in-v2.ts`.

Tier per [evidence policy](../../../../../docs/evidence/policy.md): grade A/B → scored, grade C → informative (weight 0).

## Why these four have not graduated

Each is blocked on infrastructure the scanner does not have, not on evidence.

- **`agent-operability/overlay-interception-hazard`** needs a headless browser.
  The hazard is an overlay that intercepts a click, which only exists once the
  page renders; a static fetch cannot see it.
- **`agentic-commerce/acp-endpoint-conformance-probe`** needs an
  operator-supplied base URL. ACP defines no discovery mechanism, and neither
  `ScanOptions`, the CLI flag set nor the MCP tool schema carries one.
- **`answer-selection-forensics/question-heading-answer-span-alignment`** needs
  a model. Judging whether a heading's question is answered by the span beneath
  it is not a deterministic check.
- **`mcp-server-quality/behavior-annotation-coverage-and-claim-consistency`**
  needs a model for the same reason: deciding whether a tool's annotations
  match what its description claims. The deterministic half already ships in
  `agent-interfaces/mcp-tool-contract-validity` and
  `agent-interfaces/mcp-tool-description-coverage`.

Seven stubs left this folder on 2026-08-22: six tool surveys moved to
[docs/evidence/research](../../../../../docs/evidence/research/README.md)
because their verdict is a market fact identical for every scanned URL, and
`ai-crawler-edge-parity`, which was the same check as
`bot-auth-access/ai-crawler-edge-response-parity` and folded into
[docs/evidence/merged](../../../../../docs/evidence/merged/access-crawl-control/ai-crawler-edge-parity.md).

## agent-operability

- [ ] TODO [`overlay-interception-hazard`](./agent-operability/overlay-interception-hazard.ts) — Overlay Interception Hazard (grade A, scored, `headless-browser`) · [dossier](../../../../../docs/evidence/proposals/agent-operability/overlay-interception-hazard.md)

## agentic-commerce

- [ ] TODO [`acp-endpoint-conformance-probe`](./agentic-commerce/acp-endpoint-conformance-probe.ts) — ACP Endpoint Conformance Probe (grade A, informative, `static-fetch`) · [dossier](../../../../../docs/evidence/proposals/agentic-commerce/acp-endpoint-conformance-probe.md)

## answer-selection-forensics

- [ ] TODO [`question-heading-answer-span-alignment`](./answer-selection-forensics/question-heading-answer-span-alignment.ts) — Question-Heading Answer Span Alignment (grade C, informative, `llm-assisted`) · [dossier](../../../../../docs/evidence/proposals/answer-selection-forensics/question-heading-answer-span-alignment.md)

## mcp-server-quality

- [ ] TODO [`behavior-annotation-coverage-and-claim-consistency`](./mcp-server-quality/behavior-annotation-coverage-and-claim-consistency.ts) — Behavior Annotation Coverage and Claim Consistency (grade C, informative, `llm-assisted`) · [dossier](../../../../../docs/evidence/proposals/mcp-server-quality/behavior-annotation-coverage-and-claim-consistency.md)
