# Proposed checks — remaining work

2 proposals remain unimplemented. None runs in a scan. The table lists only
unfinished work; the dossiers hold its evidence and limits.

Only public information belongs in the scanner. ACP and UCP coverage uses
artifacts and pages available to an anonymous visitor. No merchant token or
checkout mutation probe forms part of this scope. Overlay and MCP consistency
work remains deferred.

| Proposal                                                                                                       | Scope and limits                                                                           | Prerequisite                                                                     | Proposed tier                        |
| :------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------- | :----------------------------------- |
| [Overlay Interception Hazard](./agent-operability/overlay-interception-hazard.md)                              | Measure persistent click interception using Playwright's action point and retry behaviour. | Browser execution and local parity fixtures. HTML snapshots contain no geometry. | scored, subject to method validation |
| [MCP annotation claim consistency](./mcp-server-quality/behavior-annotation-coverage-and-claim-consistency.md) | Report possible conflicts between tool descriptions and behaviour hints.                   | A model judge and measured precision against human labels.                       | informative (weight 0)               |

## ACP and UCP coverage

| Protocol | Existing public coverage                                                                                                                                                                                                                                                            | Scope and limits                                                                                                                                                                                                                                                                |
| :------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ACP      | [Policy links](../audits/agentic-commerce/acp-policy-link-surface.md), [checkout offer fields](../audits/agentic-commerce/checkout-offer-field-mapping.md), and [cart handoff reachability](../audits/agentic-commerce/cart-handoff-reachability.md). These are public-site checks. | Private checkout conformance is excluded. The [withdrawn probe](../sunset/agentic-commerce/acp-endpoint-conformance-probe.md) required a merchant token and did not fit anonymous scanning.                                                                                     |
| UCP      | [Business profile readability](../audits/agentic-commerce/ucp-profile.md): JSON shape, readable services, version presence and declared HTTPS endpoint URLs.                                                                                                                        | [Declaration validation](../audits/agentic-commerce/ucp-profile-conformance.md) checks supported versions and August 2026 nested constraint expressions. Provider-specific configuration, instrument-target validation and live checkout conformance remain outside that check. |

A passing public check does not establish a working checkout. Preserve
`notApplicable` when an optional protocol artifact is absent. Neither protocol
requires every scanned site to adopt it.

Both remaining proposal dossiers carry grade A for their documented consumer mechanism.
That grade does not validate a proposed measurement method. See the
[evidence policy](../policy.md).

MCP annotation **coverage** already ships as
[`agent-interfaces/mcp-tool-annotation-coverage`](../audits/agent-interfaces/mcp-tool-annotation-coverage.md)
(grade A, informative). It is not pending work.

Completed reviews and the retired answer-span proposal live in
[research history](../research/README.md#proposal-history).
When remaining work ships, remove it from this list and keep its evidence in
the registered audit's dossier.

The separate [private integration testing plan](../../plans/integration-testing.md) describes the local ACP sandbox tool and future paid work. It is not a public audit proposal.
