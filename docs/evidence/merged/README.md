# Merged dossiers

Evidence dossiers for audits that no longer exist on their own: their signal was folded into another
audit during the v2 consolidation (Plan 4, 2026-08-22). The files are kept verbatim — the code-review
findings, the graded evidence and the sources that justified the fold are the record of *why* the
audit disappeared, and the merged audit's own dossier cites them.

Live dossiers stay in [`../audits/`](../audits/). Sunset audits (deleted outright, no successor) are
in [`../sunset/`](../sunset/).

| Absorbed slug | v1 id | Merged into | Evidence grade |
| :--- | :--- | :--- | ---: |
| [access-crawl-control/bytespider](./access-crawl-control/bytespider.md) | 2.9 | [access-crawl-control/ai-bot-directives](../audits/access-crawl-control/ai-bot-directives.md) | C |
| [access-crawl-control/cohere-ai](./access-crawl-control/cohere-ai.md) | 2.10 | [access-crawl-control/ai-bot-directives](../audits/access-crawl-control/ai-bot-directives.md) | C |
| [access-crawl-control/youbot](./access-crawl-control/youbot.md) | 2.11 | [access-crawl-control/ai-bot-directives](../audits/access-crawl-control/ai-bot-directives.md) | A |
| [access-crawl-control/diffbot](./access-crawl-control/diffbot.md) | 2.12 | [access-crawl-control/ai-bot-directives](../audits/access-crawl-control/ai-bot-directives.md) | C |
| [access-crawl-control/ai2bot](./access-crawl-control/ai2bot.md) | 2.13 | [access-crawl-control/ai-bot-directives](../audits/access-crawl-control/ai-bot-directives.md) | B |
| [operability-safety/hsts-header](./operability-safety/hsts-header.md) | 8.2 | [operability-safety/security-header-hygiene](../audits/operability-safety/security-header-hygiene.md) | B |
| [operability-safety/csp-header](./operability-safety/csp-header.md) | 8.3 | [operability-safety/security-header-hygiene](../audits/operability-safety/security-header-hygiene.md) | D |
| [operability-safety/content-type-options](./operability-safety/content-type-options.md) | 8.4 | [operability-safety/security-header-hygiene](../audits/operability-safety/security-header-hygiene.md) | C |
| [operability-safety/security-txt](./operability-safety/security-txt.md) | 8.7 | [operability-safety/security-header-hygiene](../audits/operability-safety/security-header-hygiene.md) | C |
| [machine-discovery/llms-txt-blockquote](./machine-discovery/llms-txt-blockquote.md) | 1.2 | [machine-discovery/llms-txt-structure](../audits/machine-discovery/llms-txt-structure.md) | C |
| [machine-discovery/llms-txt-sections](./machine-discovery/llms-txt-sections.md) | 1.3 | [machine-discovery/llms-txt-structure](../audits/machine-discovery/llms-txt-structure.md) | C |
| [machine-discovery/no-orphan-pages](./machine-discovery/no-orphan-pages.md) | 1.22 | [machine-discovery/discovery-index-coverage](../audits/machine-discovery/discovery-index-coverage.md) | A |
| [machine-discovery/llms-txt-link](./machine-discovery/llms-txt-link.md) | 4.11 | [machine-discovery/llms-txt-exists](../audits/machine-discovery/llms-txt-exists.md) | C |
| [machine-discovery/rss-feed-link](./machine-discovery/rss-feed-link.md) | 4.16 | [machine-discovery/rss-feed](../audits/machine-discovery/rss-feed.md) | C |
| [machine-discovery/cache-headers](./machine-discovery/cache-headers.md) | 8.11 | [machine-discovery/ai-file-delivery](../audits/machine-discovery/ai-file-delivery.md) | B |
| [machine-discovery/internal-cross-linking](./machine-discovery/internal-cross-linking.md) | 10.11 | [machine-discovery/in-content-links](../audits/machine-discovery/in-content-links.md) | B |
| [access-crawl-control/no-noindex](./access-crawl-control/no-noindex.md) | 1.13 | [access-crawl-control/robots-directives](../audits/access-crawl-control/robots-directives.md) | A |
| [access-crawl-control/meta-robots](./access-crawl-control/meta-robots.md) | 4.20 | [access-crawl-control/robots-directives](../audits/access-crawl-control/robots-directives.md) | A |
| [access-crawl-control/canonical-url](./access-crawl-control/canonical-url.md) | 4.3 | [access-crawl-control/canonical](../audits/access-crawl-control/canonical.md) | B |
| [answer-readiness/og-site-name](./answer-readiness/og-site-name.md) | 4.8 | [answer-readiness/core-open-graph](../audits/answer-readiness/core-open-graph.md) | A |
| [answer-readiness/twitter-card](./answer-readiness/twitter-card.md) | 4.10 | [answer-readiness/core-open-graph](../audits/answer-readiness/core-open-graph.md) | C |
| [answer-readiness/last-updated-indicator](./answer-readiness/last-updated-indicator.md) | 9.10 | [answer-readiness/dates-on-content](../audits/answer-readiness/dates-on-content.md) | B |
| [answer-readiness/meta-description-aeo](./answer-readiness/meta-description-aeo.md) | 9.11 | [answer-readiness/meta-description](../audits/answer-readiness/meta-description.md) | C |
| [answer-readiness/blockquote-usage](./answer-readiness/blockquote-usage.md) | 10.14 | [answer-readiness/review-signals](../audits/answer-readiness/review-signals.md) | B |
| [agent-interfaces/website-search-action](./agent-interfaces/website-search-action.md) | 3.4 | [agent-interfaces/search-endpoint](../audits/agent-interfaces/search-endpoint.md) | D |
| [agent-interfaces/openapi-link](./agent-interfaces/openapi-link.md) | 4.18 | [agent-interfaces/openapi-exists](../audits/agent-interfaces/openapi-exists.md) | B |
| [agent-interfaces/ai-catalog-link](./agent-interfaces/ai-catalog-link.md) | 4.19 | [agent-interfaces/ai-catalog-exists](../audits/agent-interfaces/ai-catalog-exists.md) | B |
| [agent-interfaces/mcp-capabilities](./agent-interfaces/mcp-capabilities.md) | 5.14 | [agent-interfaces/mcp-endpoint](../audits/agent-interfaces/mcp-endpoint.md) | D |
| [agent-interfaces/webmcp-tool-annotations](./agent-interfaces/webmcp-tool-annotations.md) | 5.24 | [agent-interfaces/mcp-endpoint](../audits/agent-interfaces/mcp-endpoint.md) | D |
| [structured-data/product-reviews](./structured-data/product-reviews.md) | 3.23 | [structured-data/review-schema](../audits/structured-data/review-schema.md) | A |
| [content-extraction/definition-elements](./content-extraction/definition-elements.md) | 6.13 | [content-extraction/semantic-lists](../audits/content-extraction/semantic-lists.md) | B |
| [answer-readiness/numbered-steps](./answer-readiness/numbered-steps.md) | 9.6 | [content-extraction/semantic-lists](../audits/content-extraction/semantic-lists.md) | B |
| [content-extraction/fast-response-time](./content-extraction/fast-response-time.md) | 8.12 | [content-extraction/server-responsiveness](../audits/content-extraction/server-responsiveness.md) | B |
| [operability-safety/webmcp-input-quality](./operability-safety/webmcp-input-quality.md) | 5.22 | [operability-safety/form-actionability](../audits/operability-safety/form-actionability.md) | B |
| [operability-safety/nav-aria-label](./operability-safety/nav-aria-label.md) | 7.3 | [operability-safety/landmark-unique](../audits/operability-safety/landmark-unique.md) | A |
| [agent-interfaces/webmcp-tool-naming](./agent-interfaces/webmcp-tool-naming.md) | 5.23 | [agent-interfaces/openapi-operation-ids](../audits/agent-interfaces/openapi-operation-ids.md) | C |
| [content-extraction/signal-density-index-content-tokens-delivered-tokens](./content-extraction/signal-density-index-content-tokens-delivered-tokens.md) | — (proposal) | [content-extraction/token-ratio](../audits/content-extraction/token-ratio.md) | B |
| [content-extraction/data-uri-and-inline-svg-token-bloat](./content-extraction/data-uri-and-inline-svg-token-bloat.md) | — (proposal) | [content-extraction/svg-bloat](../audits/content-extraction/svg-bloat.md) | B |
| [content-extraction/markdown-alternate-discoverable-resolvable-faithful-cheaper](./content-extraction/markdown-alternate-discoverable-resolvable-faithful-cheaper.md) | — (proposal) | [content-extraction/markdown-alternate](../audits/content-extraction/markdown-alternate.md) | B |

The grade column is the *absorbed* audit's own grade, not the merged audit's. A merged audit is graded
on the strongest **proven** consumer path among its sources, which is why `ai-bot-directives` ships at
B rather than inheriting youbot's A — see that dossier's Grade section. Grade and tier are separate
prices: `security-header-hygiene` also ships at B, but at tier `informative` (weight 0), because none
of the four absorbed signals has a documented AI consumer.

The v2 consolidation is complete as of Task 8 (2026-08-22): `migration-map.json` has no `merging` entries left, and every row above resolves to a live dossier in [`../audits/`](../audits/).

Task 9 (2026-08-22) adds one further row that is a *split*, not a consolidation: `webmcp-tool-naming` (5.23) was cut in two, its naming rule folded into `openapi-operation-ids` and its runtime half deferred out of v2.0. It is listed here because the audit is gone and its dossier is the record of why. The other half of that task — `service-product-schema` (3.8) — is a split with a surviving audit on both sides, so it appears in [`../audits/`](../audits/) twice over rather than here: the Service half as [`structured-data/service-schema`](../audits/structured-data/service-schema.md), the Product half inside [`structured-data/advanced-product-details`](../audits/structured-data/advanced-product-details.md).

Plan 5b Wave B (2026-08-23) adds three rows that are folds of *proposals*, not of shipped audits. Each
measured something an audit already shipped, so the proposal's mechanism was folded into that audit
rather than registered beside it — the three dossiers above have no v1 id because they were never
audits. What each fold changed is recorded under `## Absorbed proposal` in the receiving audit's
dossier.
