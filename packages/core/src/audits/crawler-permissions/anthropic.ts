import type { AuditMeta } from "../../types";
import type { CrawlerBot } from './_robots-txt-helpers';
import { CrawlerBotAudit } from './_crawler-bot-audit';

export class AnthropicAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: '2.3',
    category: 'crawler-permissions',
    title: 'anthropic-ai / ClaudeBot allowed',
    failureTitle: 'anthropic-ai / ClaudeBot allowed',
    description:
      'Without an explicit robots.txt rule, anthropic-ai / ClaudeBot may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
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
