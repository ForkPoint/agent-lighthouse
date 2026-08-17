import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { getMainContentText } from '../../parser';

// Match only unit/currency/percent/magnitude-anchored figures. A bare
// `\d+\.\d+` matched shoe sizes, raw JS floats and phone-number fragments,
// flooding the result with noise; requiring a %, $, thousands-separator or an
// "x" multiplier keeps genuinely citable statistics.
const STAT_PATTERN = /\d+(?:\.\d+)?%|\$[\d,]+(?:\.\d{2})?|\b\d{1,3}(?:,\d{3})+\b|\b\d+(?:\.\d+)?x\b/;

export class UniqueDataAudit extends Audit {
  static override meta: AuditMeta = {
    id: '10.13',
    category: 'generative-engine',
    title: 'Unique data or statistics',
    failureTitle: 'Unique data or statistics',
    description:
      'AI generative engines prioritize content with original, citable data points over vague claims. Include specific statistics and metrics.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI generative engines prioritize content with unique, citable data points because agents can quote exact figures in generated answers. Content without specific numbers reads as opinion rather than evidence, reducing its chances of being cited.',
      fix: 'Add specific statistics, percentages, dollar amounts, and measurable metrics to your content. Include original data from surveys, benchmarks, or internal metrics where possible.',
      code: '<p>Results from our 2024 survey of 1,200 developers show that 73% prefer structured APIs, with an average integration time of 2.5 hours.</p>',
      effort: 'easy',
      tags: ['content-quality', 'data', 'generative-engine'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    if (!page) {
      return this.fail(
        'No pages scanned.',
        'Content has numbers, percentages, or original data points',
        'No pages scanned',
        {
          priority: 'medium',
          description:
            'AI generative engines prioritize content with original, citable data points over vague claims. Include specific statistics and metrics.',
          code: '<p>Our platform handles 50,000 requests/second with 99.9% uptime.</p>',
        },
      );
    }

    const allMatches: string[] = [];

    for (const p of ctx.pages) {
      const text = getMainContentText(p.$);
      const matches = text.match(new RegExp(STAT_PATTERN.source, 'g'));
      if (matches) {
        allMatches.push(...matches.slice(0, 10));
      }
    }

    if (allMatches.length >= 3) {
      return this.pass(
        `Found ${allMatches.length} data points across scanned pages.`,
        'Content has numbers, percentages, or original data points',
        `Examples: ${[...new Set(allMatches)].slice(0, 5).join(', ')}`,
        page.url,
      );
    }

    if (allMatches.length > 0) {
      return this.warn(
        `Only ${allMatches.length} data point(s) found. Consider adding more statistics.`,
        'Content has numbers, percentages, or original data points',
        `Examples: ${allMatches.join(', ')}`,
        {
          priority: 'low',
          description:
            'AI generative engines prefer content with concrete, citable data over vague claims. Adding more statistics, percentages, and specific metrics makes your content more quotable in AI-generated answers, increasing the likelihood of being cited as a source.',
          code: '<p>Our solution improves performance by 65%, reduces costs by $2,500/month, and serves 10,000+ daily users.</p>',
        },
        page.url,
      );
    }

    return this.fail(
      'No numbers, percentages, or data points found in content.',
      'Content has numbers, percentages, or original data points',
      'Not found',
      {
        priority: 'medium',
        description:
          'AI generative engines prioritize content with unique, citable data points because agents can quote exact figures in generated answers. Content without specific numbers reads as opinion rather than evidence, reducing its chances of being selected as a source in AI responses.',
        code: '<p>Results from our 2024 survey of 1,200 developers show that 73% prefer structured APIs over unstructured endpoints.</p>',
      },
      page.url,
    );
  }
}
