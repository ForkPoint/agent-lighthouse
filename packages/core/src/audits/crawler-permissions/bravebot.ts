import type { AuditMeta } from "../../types";
import type { CrawlerBot } from './_robots-txt-helpers';
import { CrawlerBotAudit } from './_crawler-bot-audit';

export class BravebotAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: '2.18',
    category: 'crawler-permissions',
    title: 'Bravebot allowed',
    failureTitle: 'Bravebot allowed',
    description:
      'Without an explicit robots.txt rule, Bravebot may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Blocking Bravebot prevents your content from appearing in Brave Search AI answers and Brave Leo AI assistant responses. Allowing it gives your content visibility in the privacy-focused Brave browser ecosystem.',
      fix: 'Add an explicit User-agent: Bravebot with Allow: / rule in your robots.txt file.',
      code: 'User-agent: Bravebot\nAllow: /',
      effort: 'trivial',
      tags: ['robots-txt', 'brave', 'realtime', 'crawler-permissions'],
    },
  };

  protected bot: CrawlerBot = {
    id: '2.18',
    botName: 'Bravebot',
    displayName: 'Bravebot',
    category: 'realtime',
  };
}
