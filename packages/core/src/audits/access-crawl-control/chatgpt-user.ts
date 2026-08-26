import type { AuditMeta } from "../../types";
import type { CrawlerBot } from './_robots-txt-helpers';
import { CrawlerBotAudit } from './_crawler-bot-audit';
import { weightForGrade } from '../../scorer';

export class ChatgptUserAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: 'access-crawl-control/chatgpt-user',
    category: 'access-crawl-control',
    title: 'ChatGPT-User allowed',
    failureTitle: 'ChatGPT-User allowed',
    description:
      'Without an explicit robots.txt rule, ChatGPT-User may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/access-crawl-control/chatgpt-user.md',
    // Gate exemption: being refused is what this category reports.
    requires: ['origin-reachable'],
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
    botName: 'ChatGPT-User',
    displayName: 'ChatGPT-User',
    category: 'realtime',
  };
}
