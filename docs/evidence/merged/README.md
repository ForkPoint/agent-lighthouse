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

The grade column is the *absorbed* audit's own grade, not the merged audit's. A merged audit is graded
on the strongest **proven** consumer path among its sources, which is why `ai-bot-directives` ships at
B rather than inheriting youbot's A — see that dossier's Grade section.

Later Plan 4 tasks extend this table as their folds land.
