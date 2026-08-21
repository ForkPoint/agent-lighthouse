// TODO(merge): folds into access-crawl-control/ai-bot-directives in Plan 4 (approved 2026-08-21).
// TODO(redeem): this audit survives only if rewritten (pending triage approval). Target tier: scored.
// Evidence dossier: docs/evidence/audits/access-crawl-control/diffbot.md
// Required rework:
//   Same consolidation into ai-bot-directives.

import type { AuditMeta } from "../../types";
import type { CrawlerBot } from './_robots-txt-helpers';
import { CrawlerBotAudit } from './_crawler-bot-audit';
import { weightForGrade } from '../../scorer';

export class DiffbotAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: 'access-crawl-control/diffbot',
    category: 'access-crawl-control',
    title: 'Diffbot allowed',
    failureTitle: 'Diffbot allowed',
    description:
      'Without an explicit robots.txt rule, Diffbot may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/access-crawl-control/diffbot.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        "Blocking Diffbot prevents your content from being included in Diffbot's Knowledge Graph, which powers structured data extraction for many AI applications. Allowing it ensures your content is properly indexed for AI-powered entity extraction.",
      fix: 'Add an explicit User-agent: Diffbot with Allow: / rule in your robots.txt file.',
      code: 'User-agent: Diffbot\nAllow: /',
      effort: 'trivial',
      tags: ['robots-txt', 'diffbot', 'crawler-permissions'],
    },
  };

  protected bot: CrawlerBot = {
    id: '2.12',
    botName: 'Diffbot',
    displayName: 'Diffbot',
    category: 'training',
  };
}
