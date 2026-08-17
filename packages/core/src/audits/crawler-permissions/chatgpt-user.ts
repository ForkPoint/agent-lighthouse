import type { AuditMeta } from "../../types";
import type { CrawlerBot } from './_robots-txt-helpers';
import { CrawlerBotAudit } from './_crawler-bot-audit';

export class ChatgptUserAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: '2.14',
    category: 'crawler-permissions',
    title: 'ChatGPT-User allowed',
    failureTitle: 'ChatGPT-User allowed',
    description:
      'Without an explicit robots.txt rule, ChatGPT-User may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Blocking ChatGPT-User prevents ChatGPT from browsing your site in real-time when users ask it to visit your pages. This blocks your content from being cited in ChatGPT Browse conversations, losing a significant source of AI-driven traffic.',
      fix: 'Add an explicit User-agent: ChatGPT-User with Allow: / rule in your robots.txt file.',
      code: 'User-agent: ChatGPT-User\nAllow: /',
      effort: 'trivial',
      docsUrl: 'https://platform.openai.com/docs/bots/overview',
      tags: ['robots-txt', 'openai', 'realtime', 'crawler-permissions'],
    },
  };

  protected bot: CrawlerBot = {
    id: '2.14',
    botName: 'ChatGPT-User',
    displayName: 'ChatGPT-User',
    category: 'realtime',
  };
}
