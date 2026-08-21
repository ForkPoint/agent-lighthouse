import type { AuditMeta } from "../../types";
import type { CrawlerBot } from './_robots-txt-helpers';
import { CrawlerBotAudit } from './_crawler-bot-audit';
import { weightForGrade } from '../../scorer';

export class AmazonbotAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: 'access-crawl-control/amazonbot',
    category: 'access-crawl-control',
    title: 'Amazonbot allowed',
    failureTitle: 'Amazonbot allowed',
    description:
      'Without an explicit robots.txt rule, Amazonbot may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/access-crawl-control/amazonbot.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        "Blocking Amazonbot prevents your content from appearing in Alexa AI answers and Amazon's AI-powered search features. Allowing it gives your content visibility in Amazon's voice and commerce AI ecosystem.",
      fix: 'Add an explicit User-agent: Amazonbot with Allow: / rule in your robots.txt file.',
      code: 'User-agent: Amazonbot\nAllow: /',
      effort: 'trivial',
      docsUrl: 'https://developer.amazon.com/amazonbot',
      tags: ['robots-txt', 'amazon', 'crawler-permissions'],
    },
  };

  protected bot: CrawlerBot = {
    id: '2.8',
    botName: 'Amazonbot',
    displayName: 'Amazonbot',
    category: 'training',
  };
}
