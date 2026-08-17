import type { AuditMeta } from "../../types";
import type { CrawlerBot } from './_robots-txt-helpers';
import { CrawlerBotAudit } from './_crawler-bot-audit';

export class PerplexitybotAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: '2.4',
    category: 'crawler-permissions',
    title: 'PerplexityBot allowed',
    failureTitle: 'PerplexityBot allowed',
    description:
      'Without an explicit robots.txt rule, PerplexityBot may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Blocking PerplexityBot prevents your content from appearing in Perplexity AI search results, one of the fastest-growing AI answer engines. Allowing it gives your content visibility in AI-native search.',
      fix: 'Add an explicit User-agent: PerplexityBot with Allow: / rule in your robots.txt file.',
      code: 'User-agent: PerplexityBot\nAllow: /',
      effort: 'trivial',
      docsUrl: 'https://docs.perplexity.ai/guides/bots',
      tags: ['robots-txt', 'perplexity', 'crawler-permissions'],
    },
  };

  protected bot: CrawlerBot = {
    id: '2.4',
    botName: 'PerplexityBot',
    displayName: 'PerplexityBot',
    category: 'training',
  };
}
