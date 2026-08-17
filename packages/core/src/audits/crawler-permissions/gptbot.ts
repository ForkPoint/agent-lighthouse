import type { AuditMeta } from "../../types";
import type { CrawlerBot } from './_robots-txt-helpers';
import { CrawlerBotAudit } from './_crawler-bot-audit';

export class GptbotAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: '2.1',
    category: 'crawler-permissions',
    title: 'GPTBot allowed',
    failureTitle: 'GPTBot allowed',
    description:
      'Without an explicit robots.txt rule, GPTBot may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        "Blocking GPTBot prevents your content from being used by OpenAI's models and appearing in ChatGPT responses. Explicitly allowing it signals that your site welcomes AI indexing for the largest AI platform by user base.",
      fix: 'Add an explicit User-agent: GPTBot with Allow: / rule in your robots.txt file.',
      code: 'User-agent: GPTBot\nAllow: /',
      effort: 'trivial',
      docsUrl: 'https://platform.openai.com/docs/bots/overview',
      tags: ['robots-txt', 'openai', 'crawler-permissions'],
    },
  };

  protected bot: CrawlerBot = {
    id: '2.1',
    botName: 'GPTBot',
    displayName: 'GPTBot',
    category: 'training',
  };
}
