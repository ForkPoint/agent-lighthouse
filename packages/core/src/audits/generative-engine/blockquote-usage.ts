import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

export class BlockquoteUsageAudit extends Audit {
  static override meta: AuditMeta = {
    id: '10.14',
    category: 'generative-engine',
    title: 'Blockquote/callout usage',
    failureTitle: 'Blockquote/callout usage',
    description:
      'AI engines extract <blockquote> content as notable citations and key takeaways in generated answers.',
    scoreDisplayMode: 'binary',
    weight: 1.0,
    defaultPriority: 'low',
    guidance: {
      impact:
        'AI generative engines extract <blockquote> content as notable citations and key takeaways when generating summaries. Blockquoted text is treated as high-signal content that deserves prominent placement in AI-generated answers.',
      fix: 'Wrap key quotes, testimonials, and important takeaways in <blockquote> elements. Add a <footer> with <cite> for proper attribution.',
      code: '<blockquote>\n  <p>"The single most impactful change is adding structured data to your pages."</p>\n  <footer>- <cite>Industry Expert</cite></footer>\n</blockquote>',
      effort: 'trivial',
      tags: ['content-structure', 'html', 'generative-engine'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    if (!page) {
      return this.fail('No pages scanned.', '<blockquote> elements present', 'No pages scanned', {
        priority: 'low',
        description:
          'AI engines extract <blockquote> content as notable citations and key takeaways in generated answers.',
        code: '<blockquote>\n  <p>Key insight or notable quote here.</p>\n</blockquote>',
      });
    }

    let totalBlockquotes = 0;
    let pageWithBlockquote: string | undefined;

    for (const p of ctx.pages) {
      const count = p.$('blockquote').length;
      if (count > 0) {
        totalBlockquotes += count;
        if (!pageWithBlockquote) {
          pageWithBlockquote = p.url;
        }
      }
    }

    if (totalBlockquotes > 0) {
      return this.pass(
        `Found ${totalBlockquotes} <blockquote> element(s) across scanned pages.`,
        '<blockquote> elements present',
        `${totalBlockquotes} blockquote(s)`,
        pageWithBlockquote,
      );
    }

    return this.fail(
      'No <blockquote> elements found on any scanned page.',
      '<blockquote> elements present',
      'Not found',
      {
        priority: 'low',
        description:
          'AI generative engines extract <blockquote> content as notable citations and key takeaways when generating summaries. Blockquoted text is treated as high-signal content that deserves prominent placement in AI-generated answers, making it an effective way to highlight your most important points.',
        code: '<blockquote>\n  <p>"The single most impactful change is adding structured data to your pages."</p>\n  <footer>- <cite>Source attribution</cite></footer>\n</blockquote>',
      },
      page.url,
    );
  }
}
