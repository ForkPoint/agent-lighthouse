import type { AuditMeta } from "../../types";
import type { CrawlerBot } from './_robots-txt-helpers';
import { CrawlerBotAudit } from './_crawler-bot-audit';
import { weightForGrade } from '../../scorer';

export class AnthropicAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: 'access-crawl-control/anthropic-ai',
    category: 'access-crawl-control',
    title: 'anthropic-ai / ClaudeBot allowed',
    failureTitle: 'anthropic-ai / ClaudeBot allowed',
    description:
      'Without an explicit robots.txt rule, anthropic-ai / ClaudeBot may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/access-crawl-control/anthropic-ai.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        "Blocking anthropic-ai / ClaudeBot prevents your content from being used by Anthropic's Claude models. Explicitly allowing it ensures your site is indexed for Claude's training data and knowledge base.",
      fix: 'Add explicit User-agent rules for both anthropic-ai and ClaudeBot with Allow: / in your robots.txt file.',
      code: 'User-agent: anthropic-ai\nAllow: /\n\nUser-agent: ClaudeBot\nAllow: /',
      effort: 'trivial',
      tags: ['robots-txt', 'anthropic', 'crawler-permissions'],
    },
  };

  protected bot: CrawlerBot = {
    id: '2.3',
    botName: 'anthropic-ai',
    displayName: 'anthropic-ai / ClaudeBot',
    category: 'training',
    aliases: ['ClaudeBot'],
  };
}
