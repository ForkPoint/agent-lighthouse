// TODO(merge): folds into access-crawl-control/ai-bot-directives in Plan 4 (approved 2026-08-21).
// TODO(redeem): this audit survives only if rewritten (pending triage approval). Target tier: scored.
// Evidence dossier: docs/evidence/audits/access-crawl-control/cohere-ai.md
// Required rework:
//   Same consolidation into ai-bot-directives.

import type { AuditMeta } from "../../types";
import type { CrawlerBot } from './_robots-txt-helpers';
import { CrawlerBotAudit } from './_crawler-bot-audit';
import { weightForGrade } from '../../scorer';

export class CohereAiAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: 'access-crawl-control/cohere-ai',
    category: 'access-crawl-control',
    title: 'cohere-ai allowed',
    failureTitle: 'cohere-ai allowed',
    description:
      'Without an explicit robots.txt rule, cohere-ai may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/access-crawl-control/cohere-ai.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        "Blocking cohere-ai prevents your content from being used by Cohere's enterprise AI models, which power search and RAG applications for many businesses. Allowing it ensures your content is available in Cohere-powered AI search products.",
      fix: 'Add an explicit User-agent: cohere-ai with Allow: / rule in your robots.txt file.',
      code: 'User-agent: cohere-ai\nAllow: /',
      effort: 'trivial',
      tags: ['robots-txt', 'cohere', 'crawler-permissions'],
    },
  };

  protected bot: CrawlerBot = {
    id: '2.10',
    botName: 'cohere-ai',
    displayName: 'cohere-ai',
    category: 'training',
  };
}
