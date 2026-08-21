// TODO(redeem): this audit survives only if rewritten (pending triage approval). Target tier: scored.
// Evidence dossier: docs/evidence/audits/crawler-permissions/youbot.md
// Required rework:
//   Same consolidation into ai-bot-directives.

import type { AuditMeta } from "../../types";
import type { CrawlerBot } from './_robots-txt-helpers';
import { CrawlerBotAudit } from './_crawler-bot-audit';

export class YoubotAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: '2.11',
    category: 'crawler-permissions',
    title: 'YouBot allowed',
    failureTitle: 'YouBot allowed',
    description:
      'Without an explicit robots.txt rule, YouBot may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Blocking YouBot prevents your content from appearing in You.com AI search results. Allowing it gives your content visibility in this AI-native search engine that generates direct answers for users.',
      fix: 'Add an explicit User-agent: YouBot with Allow: / rule in your robots.txt file.',
      code: 'User-agent: YouBot\nAllow: /',
      effort: 'trivial',
      tags: ['robots-txt', 'you-com', 'crawler-permissions'],
    },
  };

  protected bot: CrawlerBot = {
    id: '2.11',
    botName: 'YouBot',
    displayName: 'YouBot',
    category: 'training',
  };
}
