import type { AuditMeta } from "../../types";
import type { CrawlerBot } from './_robots-txt-helpers';
import { CrawlerBotAudit } from './_crawler-bot-audit';

export class CcbotAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: '2.6',
    category: 'crawler-permissions',
    title: 'CCBot allowed',
    failureTitle: 'CCBot allowed',
    description:
      'Without an explicit robots.txt rule, CCBot may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        "Blocking CCBot prevents your content from being included in the Common Crawl dataset, which is a foundational training data source for many AI models. Allowing it broadens your content's reach across multiple AI systems.",
      fix: 'Add an explicit User-agent: CCBot with Allow: / rule in your robots.txt file.',
      code: 'User-agent: CCBot\nAllow: /',
      effort: 'trivial',
      docsUrl: 'https://commoncrawl.org/ccbot',
      tags: ['robots-txt', 'common-crawl', 'crawler-permissions'],
    },
  };

  protected bot: CrawlerBot = {
    id: '2.6',
    botName: 'CCBot',
    displayName: 'CCBot',
    category: 'training',
  };
}
