import type { AuditMeta } from "../../types";
import type { CrawlerBot } from './_robots-txt-helpers';
import { CrawlerBotAudit } from './_crawler-bot-audit';
import { weightForGrade } from '../../scorer';

export class OaiSearchbotAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: 'access-crawl-control/oai-searchbot',
    category: 'access-crawl-control',
    title: 'OAI-SearchBot allowed',
    failureTitle: 'OAI-SearchBot allowed',
    description:
      'Without an explicit robots.txt rule, OAI-SearchBot may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/access-crawl-control/oai-searchbot.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        "Blocking OAI-SearchBot prevents your content from appearing in OpenAI's SearchGPT and ChatGPT web search results. Allowing it ensures your site is discoverable through OpenAI's real-time search features.",
      fix: 'Add an explicit User-agent: OAI-SearchBot with Allow: / rule in your robots.txt file.',
      code: 'User-agent: OAI-SearchBot\nAllow: /',
      effort: 'trivial',
      docsUrl: 'https://platform.openai.com/docs/bots/overview',
      tags: ['robots-txt', 'openai', 'realtime', 'crawler-permissions'],
    },
  };

  protected bot: CrawlerBot = {
    botName: 'OAI-SearchBot',
    displayName: 'OAI-SearchBot',
    category: 'realtime',
  };
}
