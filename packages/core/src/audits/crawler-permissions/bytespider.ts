import type { AuditMeta } from "../../types";
import type { CrawlerBot } from './_robots-txt-helpers';
import { CrawlerBotAudit } from './_crawler-bot-audit';

export class BytespiderAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: '2.9',
    category: 'crawler-permissions',
    title: 'Bytespider allowed',
    failureTitle: 'Bytespider allowed',
    description:
      'Without an explicit robots.txt rule, Bytespider may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        "Blocking Bytespider prevents your content from being used by ByteDance's AI products including TikTok search and Doubao AI. Allowing it extends your content's reach to ByteDance's large user base.",
      fix: 'Add an explicit User-agent: Bytespider with Allow: / rule in your robots.txt file.',
      code: 'User-agent: Bytespider\nAllow: /',
      effort: 'trivial',
      tags: ['robots-txt', 'bytedance', 'crawler-permissions'],
    },
  };

  protected bot: CrawlerBot = {
    id: '2.9',
    botName: 'Bytespider',
    displayName: 'Bytespider',
    category: 'training',
  };
}
