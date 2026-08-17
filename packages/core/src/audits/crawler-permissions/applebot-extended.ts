import type { AuditMeta } from "../../types";
import type { CrawlerBot } from './_robots-txt-helpers';
import { CrawlerBotAudit } from './_crawler-bot-audit';

export class ApplebotExtendedAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: '2.5',
    category: 'crawler-permissions',
    title: 'Applebot-Extended allowed',
    failureTitle: 'Applebot-Extended allowed',
    description:
      'Without an explicit robots.txt rule, Applebot-Extended may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        "Blocking Applebot-Extended prevents your content from being used in Apple Intelligence features, Siri AI answers, and Safari Highlights. Allowing it ensures visibility across Apple's AI ecosystem.",
      fix: 'Add an explicit User-agent: Applebot-Extended with Allow: / rule in your robots.txt file.',
      code: 'User-agent: Applebot-Extended\nAllow: /',
      effort: 'trivial',
      docsUrl: 'https://support.apple.com/en-us/111042',
      tags: ['robots-txt', 'apple', 'crawler-permissions'],
    },
  };

  protected bot: CrawlerBot = {
    id: '2.5',
    botName: 'Applebot-Extended',
    displayName: 'Applebot-Extended',
    category: 'training',
  };
}
