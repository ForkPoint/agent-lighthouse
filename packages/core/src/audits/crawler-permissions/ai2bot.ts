// TODO(redeem): this audit survives only if rewritten (pending triage approval). Target tier: scored.
// Evidence dossier: docs/evidence/audits/crawler-permissions/ai2bot.md
// Required rework:
//   Same consolidation into ai-bot-directives.

import type { AuditMeta } from "../../types";
import type { CrawlerBot } from './_robots-txt-helpers';
import { CrawlerBotAudit } from './_crawler-bot-audit';

export class Ai2botAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: '2.13',
    category: 'crawler-permissions',
    title: 'AI2Bot allowed',
    failureTitle: 'AI2Bot allowed',
    description:
      'Without an explicit robots.txt rule, AI2Bot may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Blocking AI2Bot prevents your content from being used by the Allen Institute for AI (AI2), which powers research models and semantic search tools. Allowing it contributes to open AI research and ensures broader content visibility.',
      fix: 'Add an explicit User-agent: AI2Bot with Allow: / rule in your robots.txt file.',
      code: 'User-agent: AI2Bot\nAllow: /',
      effort: 'trivial',
      tags: ['robots-txt', 'ai2', 'crawler-permissions'],
    },
  };

  protected bot: CrawlerBot = {
    id: '2.13',
    botName: 'AI2Bot',
    displayName: 'AI2Bot',
    category: 'training',
  };
}
