import type { AuditMeta } from "../../types";
import type { CrawlerBot } from './_robots-txt-helpers';
import { CrawlerBotAudit } from './_crawler-bot-audit';
import { weightForGrade } from '../../scorer';

export class GoogleExtendedAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: 'access-crawl-control/google-extended',
    category: 'access-crawl-control',
    title: 'Google-Extended allowed',
    failureTitle: 'Google-Extended allowed',
    description:
      'Without an explicit robots.txt rule, Google-Extended may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/access-crawl-control/google-extended.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        "Blocking Google-Extended prevents your content from being used in Google's AI features like Gemini and AI Overviews. Allowing it ensures your site appears in Google's AI-powered search experiences alongside traditional results.",
      fix: 'Add an explicit User-agent: Google-Extended with Allow: / rule in your robots.txt file.',
      code: 'User-agent: Google-Extended\nAllow: /',
      effort: 'trivial',
      docsUrl:
        'https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers',
      tags: ['robots-txt', 'google', 'crawler-permissions'],
    },
  };

  protected bot: CrawlerBot = {
    id: '2.2',
    botName: 'Google-Extended',
    displayName: 'Google-Extended',
    category: 'training',
  };
}
