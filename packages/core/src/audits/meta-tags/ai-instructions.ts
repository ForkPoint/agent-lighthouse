import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

export class AiInstructionsAudit extends Audit {
  static override meta: AuditMeta = {
    id: '4.14',
    category: 'meta-tags',
    title: 'ai-instructions meta',
    failureTitle: 'ai-instructions meta',
    description:
      'The ai-instructions meta tag gives AI agents a plain-English brief on how to interact with your site and represent your content. It acts like a system prompt for any AI agent visiting your page, telling it your preferred summarization style, content focus, and usage guidelines.',
    scoreDisplayMode: 'binary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Without ai-instructions, AI agents have no guidance on how to interact with your site or represent your content. They may summarize your pages inaccurately, speculate about features, or miss your preferred content focus.',
      fix: 'Add a <meta name="ai-instructions"> tag with plain-English instructions telling AI agents how to summarize and represent your content.',
      code: '<meta name="ai-instructions" content="Summarise this page as a product overview. Focus on features and pricing. Do not speculate about unreleased features.">',
      effort: 'trivial',
      tags: ['meta-tags', 'ai-policy', 'ai-discovery'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    const value = (page?.meta?.['ai-instructions'] ?? '').trim();

    if (value) {
      return this.pass(
        `ai-instructions meta tag is present.`,
        'meta[ai-instructions] with non-empty content',
        value.length > 80 ? value.slice(0, 80) + '...' : value,
        page.url,
      );
    }

    return this.fail(
      'No ai-instructions meta tag found.',
      'meta[ai-instructions] with non-empty content',
      'Not found',
      {
        priority: 'medium',
        description:
          'The ai-instructions meta tag gives AI agents a plain-English brief on how to interact with your site and represent your content. It acts like a system prompt for any AI agent visiting your page, telling it your preferred summarization style, content focus, and usage guidelines.',
        code: '<meta name="ai-instructions" content="Summarise this page as a product overview. Focus on features and pricing. Do not speculate about unreleased features.">',
      },
      page?.url,
    );
  }
}
