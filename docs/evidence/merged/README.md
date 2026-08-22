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

The grade column is the *absorbed* audit's own grade, not the merged audit's. A merged audit is graded
on the strongest **proven** consumer path among its sources, which is why `ai-bot-directives` ships at
B rather than inheriting youbot's A — see that dossier's Grade section. Grade and tier are separate
prices: `security-header-hygiene` also ships at B, but at tier `informative` (weight 0), because none
of the four absorbed signals has a documented AI consumer.

Later Plan 4 tasks extend this table as their folds land.
