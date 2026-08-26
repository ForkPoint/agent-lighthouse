import type { AuditMeta } from "../../types";
import type { CrawlerBot } from './_robots-txt-helpers';
import { CrawlerBotAudit } from './_crawler-bot-audit';
import { weightForGrade } from '../../scorer';

export class DuckassistbotAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: 'access-crawl-control/duckassistbot',
    category: 'access-crawl-control',
    title: 'DuckAssistBot allowed',
    failureTitle: 'DuckAssistBot allowed',
    description:
      'Without an explicit robots.txt rule, DuckAssistBot may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/access-crawl-control/duckassistbot.md',
    // Gate exemption: being refused is what this category reports.
    requires: ['origin-reachable'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        "Blocking DuckAssistBot prevents your content from appearing in DuckDuckGo's AI-powered DuckAssist feature, which generates instant answers from crawled web pages. Allowing it ensures visibility in this privacy-first AI search experience.",
      fix: 'Add an explicit User-agent: DuckAssistBot with Allow: / rule in your robots.txt file.',
      code: 'User-agent: DuckAssistBot\nAllow: /',
      effort: 'trivial',
      tags: ['robots-txt', 'duckduckgo', 'realtime', 'crawler-permissions'],
    },
  };

  protected bot: CrawlerBot = {
    botName: 'DuckAssistBot',
    displayName: 'DuckAssistBot',
    category: 'realtime',
  };
}
