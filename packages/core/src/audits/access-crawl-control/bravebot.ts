import type { AuditMeta } from "../../types";
import type { CrawlerBot } from './_robots-txt-helpers';
import { CrawlerBotAudit } from './_crawler-bot-audit';
import { weightForGrade } from '../../scorer';

export class BravebotAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: 'access-crawl-control/bravebot',
    category: 'access-crawl-control',
    title: 'Bravebot allowed',
    failureTitle: 'Bravebot allowed',
    description:
      'Without an explicit robots.txt rule, Bravebot may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/access-crawl-control/bravebot.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Blocking Bravebot prevents your content from appearing in Brave Search AI answers and Brave Leo AI assistant responses. Allowing it gives your content visibility in the privacy-focused Brave browser ecosystem.',
      fix: 'Add an explicit User-agent: Bravebot with Allow: / rule in your robots.txt file.',
      code: 'User-agent: Bravebot\nAllow: /',
      effort: 'trivial',
      tags: ['robots-txt', 'brave', 'realtime', 'crawler-permissions'],
    },
  };

  protected bot: CrawlerBot = {
    botName: 'Bravebot',
    displayName: 'Bravebot',
    category: 'realtime',
  };
}
