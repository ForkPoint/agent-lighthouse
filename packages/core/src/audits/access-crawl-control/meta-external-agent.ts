import type { AuditMeta } from "../../types";
import type { CrawlerBot } from './_robots-txt-helpers';
import { CrawlerBotAudit } from './_crawler-bot-audit';
import { weightForGrade } from '../../scorer';

export class MetaExternalAgentAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: 'access-crawl-control/meta-external-agent',
    category: 'access-crawl-control',
    title: 'Meta-ExternalAgent allowed',
    failureTitle: 'Meta-ExternalAgent allowed',
    description:
      'Without an explicit robots.txt rule, Meta-ExternalAgent may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/access-crawl-control/meta-external-agent.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        "Blocking Meta-ExternalAgent prevents your content from being used in Meta's AI features across Facebook, Instagram, and WhatsApp. Allowing it ensures visibility in Meta's AI-powered recommendations and summaries.",
      fix: 'Add an explicit User-agent: Meta-ExternalAgent with Allow: / rule in your robots.txt file.',
      code: 'User-agent: Meta-ExternalAgent\nAllow: /',
      effort: 'trivial',
      tags: ['robots-txt', 'meta', 'crawler-permissions'],
    },
  };

  protected bot: CrawlerBot = {
    id: '2.7',
    botName: 'Meta-ExternalAgent',
    displayName: 'Meta-ExternalAgent',
    category: 'training',
  };
}
