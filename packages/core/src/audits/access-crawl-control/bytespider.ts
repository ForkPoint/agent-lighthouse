// TODO(merge): folds into access-crawl-control/ai-bot-directives in Plan 4 (approved 2026-08-21).
// TODO(redeem): this audit survives only if rewritten (pending triage approval). Target tier: scored.
// Evidence dossier: docs/evidence/audits/access-crawl-control/bytespider.md
// Required rework:
//   Consolidate all low-signal per-bot audits into one 'ai-bot-directives' audit: parse robots.txt
//   once, informational per-bot table, score only on documented-active bots.

import type { AuditMeta } from "../../types";
import type { CrawlerBot } from './_robots-txt-helpers';
import { CrawlerBotAudit } from './_crawler-bot-audit';
import { weightForGrade } from '../../scorer';

export class BytespiderAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: 'access-crawl-control/bytespider',
    category: 'access-crawl-control',
    title: 'Bytespider allowed',
    failureTitle: 'Bytespider allowed',
    description:
      'Without an explicit robots.txt rule, Bytespider may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/access-crawl-control/bytespider.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        "Blocking Bytespider prevents your content from being used by ByteDance's AI products including TikTok search and Doubao AI. Allowing it extends your content's reach to ByteDance's large user base.",
      fix: 'Add an explicit User-agent: Bytespider with Allow: / rule in your robots.txt file.',
      code: 'User-agent: Bytespider\nAllow: /',
      effort: 'trivial',
      tags: ['robots-txt', 'bytedance', 'crawler-permissions'],
    },
  };

  protected bot: CrawlerBot = {
    id: '2.9',
    botName: 'Bytespider',
    displayName: 'Bytespider',
    category: 'training',
  };
}
