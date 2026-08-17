import type { AuditMeta } from "../../types";
import type { CrawlerBot } from './_robots-txt-helpers';
import { CrawlerBotAudit } from './_crawler-bot-audit';

export class ClaudeUserAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: '2.15',
    category: 'crawler-permissions',
    title: 'Claude-User allowed',
    failureTitle: 'Claude-User allowed',
    description:
      'Without an explicit robots.txt rule, Claude-User may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Blocking Claude-User prevents Claude from browsing your site in real-time when users ask it to visit your pages. This blocks your content from being cited in Claude conversations with web access enabled.',
      fix: 'Add an explicit User-agent: Claude-User with Allow: / rule in your robots.txt file.',
      code: 'User-agent: Claude-User\nAllow: /',
      effort: 'trivial',
      tags: ['robots-txt', 'anthropic', 'realtime', 'crawler-permissions'],
    },
  };

  protected bot: CrawlerBot = {
    id: '2.15',
    botName: 'Claude-User',
    displayName: 'Claude-User',
    category: 'realtime',
  };
}
