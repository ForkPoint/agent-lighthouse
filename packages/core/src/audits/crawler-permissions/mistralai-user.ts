import type { AuditMeta } from "../../types";
import type { CrawlerBot } from './_robots-txt-helpers';
import { CrawlerBotAudit } from './_crawler-bot-audit';

export class MistralaiUserAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: '2.20',
    category: 'crawler-permissions',
    title: 'MistralAI-User allowed',
    failureTitle: 'MistralAI-User allowed',
    description:
      'Without an explicit robots.txt rule, MistralAI-User may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        "Blocking MistralAI-User prevents Mistral AI's Le Chat from browsing your site in real-time when users ask it to visit your pages. Allowing it ensures your content can be cited in Mistral-powered AI conversations.",
      fix: 'Add an explicit User-agent: MistralAI-User with Allow: / rule in your robots.txt file.',
      code: 'User-agent: MistralAI-User\nAllow: /',
      effort: 'trivial',
      tags: ['robots-txt', 'mistral', 'realtime', 'crawler-permissions'],
    },
  };

  protected bot: CrawlerBot = {
    id: '2.20',
    botName: 'MistralAI-User',
    displayName: 'MistralAI-User',
    category: 'realtime',
  };
}
