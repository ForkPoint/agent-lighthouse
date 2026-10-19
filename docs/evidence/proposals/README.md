# Proposed checks — evidence dossiers

3 proposed checks and 1 retired one from the 2026-08-20 novel-checks research pass. Each dossier states what the check verifies, the falsifiable mechanism behind it, cited evidence from the [source registry](../sources.json), competitor coverage, and an implementation sketch. Grading rubric: [evidence policy](../policy.md).

Seven dossiers left this folder on 2026-08-22 (Plan 5, Task 2): six tool
surveys moved to [../research](../research/README.md) because their verdict is
a market fact identical for every scanned URL, and `ai-crawler-edge-parity`,
which was the same check as `bot-auth-access/ai-crawler-edge-response-parity`
and folded into
[../merged/access-crawl-control/ai-crawler-edge-parity.md](../merged/access-crawl-control/ai-crawler-edge-parity.md).

Dossiers that graduate to a shipped audit move to
[../audits](../audits/README.md) with `status: merged`-style audit frontmatter;
their row leaves the table below and the count above drops by one.

Grades: **A** = documented consumer behavior or ratified standard · **B** = draft standard with adoption, or strong empirical data · **C** = plausible convention, unproven · **D** = speculative.

| Grade | Check                                                                                                                            | Domain             | Uniqueness | Implementation        | Scoring tier           |
| :---- | :------------------------------------------------------------------------------------------------------------------------------- | :----------------- | :--------- | :-------------------- | :--------------------- |
| A     | [Overlay Interception Hazard](./agent-operability/overlay-interception-hazard.md)                                                | agent-operability  | unique     | `headless-browser`    | scored                 |
| A     | [ACP Endpoint Conformance Probe](./agentic-commerce/acp-endpoint-conformance-probe.md)                                           | agentic-commerce   | unique     | `operator-credential` | informative (weight 0) |
| A     | [Behavior Annotation Coverage and Claim Consistency](./mcp-server-quality/behavior-annotation-coverage-and-claim-consistency.md) | mcp-server-quality | unique     | `llm-assisted`        | informative (weight 0) |

Retired, kept as the record of why:

| Grade | Check                                                                                                            | Domain                     | Reason                                                                                    |
| :---- | :--------------------------------------------------------------------------------------------------------------- | :------------------------- | :---------------------------------------------------------------------------------------- |
| D     | [Question-Heading Answer Span Alignment](./answer-selection-forensics/question-heading-answer-span-alignment.md) | answer-selection-forensics | no documented consumer; invented thresholds; the checkable part ships in two other audits |

The 2026-10-19 evidence review re-graded all four. Its claim-by-claim log is
[REVIEW-2026-10-19.md](./REVIEW-2026-10-19.md).

On 2026-10-19 the deterministic coverage half of Behavior Annotation Coverage
and Claim Consistency shipped as
[`agent-interfaces/mcp-tool-annotation-coverage`](../audits/agent-interfaces/mcp-tool-annotation-coverage.md)
(grade A, scored). The dossier stays here for the claim-consistency judge,
which needs a model. The retired dossier stays in this folder as the record;
its stub was deleted. Overlay Interception Hazard needs a headless browser and
ACP Endpoint Conformance Probe needs a merchant-issued token; the scanner has
neither, so both stay proposals.
