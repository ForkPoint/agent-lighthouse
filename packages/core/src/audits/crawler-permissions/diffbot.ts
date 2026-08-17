import type { AuditMeta } from "../../types";
import type { CrawlerBot } from './_robots-txt-helpers';
import { CrawlerBotAudit } from './_crawler-bot-audit';

export class DiffbotAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: '2.12',
    category: 'crawler-permissions',
    title: 'Diffbot allowed',
    failureTitle: 'Diffbot allowed',
    description:
      'Without an explicit robots.txt rule, Diffbot may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        "Blocking Diffbot prevents your content from being included in Diffbot's Knowledge Graph, which powers structured data extraction for many AI applications. Allowing it ensures your content is properly indexed for AI-powered entity extraction.",
      fix: 'Add an explicit User-agent: Diffbot with Allow: / rule in your robots.txt file.',
      code: 'User-agent: Diffbot\nAllow: /',
      effort: 'trivial',
      tags: ['robots-txt', 'diffbot', 'crawler-permissions'],
    },
  };

  protected bot: CrawlerBot = {
    id: '2.12',
    botName: 'Diffbot',
    displayName: 'Diffbot',
    category: 'training',
  };
}
