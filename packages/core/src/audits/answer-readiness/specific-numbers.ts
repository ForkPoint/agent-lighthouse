import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';
import { getMainContentText } from '../../parser';

// A "specific data point" must carry a unit, a percent/currency symbol, a
// grouped thousands separator, or be a small word-bounded range like "3-5
// days". The old bare `\d+\s*[-–]\s*\d+` branch matched timestamps, phone
// numbers and SKUs (e.g. "555-123-4567", "12-34-5678"), producing junk
// "examples" — those no longer qualify because nothing here matches a raw
// number with no unit/symbol.
const UNIT =
  '(?:%|kg|kgs|g|mg|lbs?|oz|cm|mm|km|in|ft|hrs?|hours?|mins?|minutes?|seconds?|secs?|days?|weeks?|months?|years?|ml|cl|l|liters?|litres?|gb|mb|tb|k|million|billion|degrees?|x|mph|reps?|sets?|calories?|cal)';
const DATA_PATTERN = new RegExp(
  // percentage
  '\\d+(?:\\.\\d+)?\\s*%' +
    // currency amount
    '|[$€£¥]\\s?\\d[\\d,]*(?:\\.\\d+)?' +
    // ranges with a unit ("3-5 business days", "10–15 minutes")
    '|\\b\\d{1,4}\\s*[-–—]\\s*\\d{1,4}(?:\\s+\\w+)?\\s+' +
    UNIT +
    '\\b' +
    // hyphenated unit ("30-day", "24-hour")
    '|\\b\\d{1,4}-' +
    UNIT +
    '\\b' +
    // grouped thousands ("10,000", "50,000")
    '|\\b\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?\\b' +
    // number directly followed by a unit ("200g", "99.9%", "5 days")
    '|\\b\\d+(?:\\.\\d+)?\\s*' +
    UNIT +
    '\\b',
);

export class SpecificNumbersAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'answer-readiness/specific-numbers',
    category: 'answer-readiness',
    title: 'Specific numbers and data points',
    failureTitle: 'Specific numbers and data points',
    description:
      'AI engines prefer answers with concrete data points over vague statements. Include specific numbers, percentages, and metrics in your content.',
    scoreDisplayMode: 'binary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier: 'docs/evidence/audits/answer-readiness/specific-numbers.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI answer engines strongly prefer content with concrete data points over vague claims. Pages with specific numbers, percentages, and metrics are ranked higher for data-driven queries because agents can cite exact figures in generated answers.',
      fix: 'Add specific numbers, percentages, dollar amounts, and measurable metrics throughout your content. Replace vague claims ("significant improvement") with concrete data ("65% improvement").',
      code: '<p>Our platform processes 50,000 requests per second with 99.9% uptime, reducing average response time by 65% compared to alternatives.</p>',
      effort: 'easy',
      tags: ['content-quality', 'copywriting', 'answer-engine'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    if (!page) {
      return this.fail(
        'No pages scanned.',
        'Content contains digits, percentages, or dollar amounts',
        'No pages scanned',
        {
          priority: 'medium',
          description: SpecificNumbersAudit.meta.description,
          code: '<p>Our platform reduces deployment time by 40%, serving 10,000+ daily requests at $0.01 per API call.</p>',
        },
      );
    }

    const matchingPages: string[] = [];
    const examples: string[] = [];

    for (const p of ctx.pages) {
      const text = getMainContentText(p.$);
      const matches = text.match(new RegExp(DATA_PATTERN.source, 'gi'));
      if (matches && matches.length > 0) {
        matchingPages.push(p.url);
        if (examples.length < 5) {
          examples.push(...matches.slice(0, 5 - examples.length));
        }
      }
    }

    if (matchingPages.length > 0) {
      return this.pass(
        `Specific data points found on ${matchingPages.length} page(s).`,
        'Content contains digits, percentages, or dollar amounts',
        `Examples: ${examples.join(', ')}`,
        page.url,
      );
    }

    return this.fail(
      'No specific numbers, percentages, or dollar amounts found in content.',
      'Content contains digits, percentages, or dollar amounts',
      'Not found',
      {
        priority: 'medium',
        description:
          'AI answer engines strongly prefer content with concrete data points over vague claims. Pages with specific numbers, percentages, and metrics are ranked higher for data-driven queries because agents can cite exact figures in generated answers rather than paraphrasing vague language.',
        code: '<p>Our platform processes 50,000 requests per second with 99.9% uptime, reducing average response time by 65% compared to alternatives.</p>',
      },
      page.url,
    );
  }
}
