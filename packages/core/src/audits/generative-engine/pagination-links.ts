import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

export class PaginationLinksAudit extends Audit {
  static override meta: AuditMeta = {
    id: '10.12',
    category: 'generative-engine',
    title: 'Pagination links',
    failureTitle: 'Pagination links',
    description:
      'AI crawlers use rel="prev" and rel="next" to navigate paginated content series without missing pages.',
    scoreDisplayMode: 'informative',
    weight: 0,
    applicablePageTypes: ['category'],
    defaultPriority: 'low',
    deprecated: {
      notice: 'Google, the only consumer ever documented, states it no longer uses rel=prev/next; the head-link form is invalid per the WHATWG HTML standard.',
      link: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/NOT-A-FACTOR.md#generative-enginepagination-links',
    },
    guidance: {
      impact:
        'AI crawlers use rel="prev" and rel="next" to navigate paginated content series sequentially. Without these links, agents may miss pages in a series or index paginated listings out of order, leading to incomplete content coverage in AI knowledge bases.',
      fix: 'Add <link rel="prev"> and <link rel="next"> tags in the <head> of paginated pages pointing to the previous and next pages in the series.',
      code: '<link rel="prev" href="/blog/page/1">\n<link rel="next" href="/blog/page/3">',
      effort: 'easy',
      tags: ['pagination', 'html', 'generative-engine'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    if (!page) {
      return this.fail(
        'No pages scanned.',
        '<link rel="prev"> and <link rel="next"> in head',
        'No pages scanned',
        {
          priority: 'low',
          description:
            'AI crawlers use rel="prev" and rel="next" to navigate paginated content series without missing pages.',
          code: '<link rel="prev" href="/blog/page/1">\n<link rel="next" href="/blog/page/3">',
        },
      );
    }

    for (const p of ctx.pages) {
      const hasPrev = p.headLinks.some((l) => l.rel === 'prev');
      const hasNext = p.headLinks.some((l) => l.rel === 'next');

      if (hasPrev || hasNext) {
        const found: string[] = [];
        if (hasPrev) found.push('rel="prev"');
        if (hasNext) found.push('rel="next"');

        return this.pass(
          `Pagination links found: ${found.join(' and ')}.`,
          '<link rel="prev"> and <link rel="next"> in head',
          found.join(', '),
          p.url,
        );
      }
    }

    // Pagination links are only needed on paginated content; their absence is not critical
    return this.warn(
      'No <link rel="prev"> or <link rel="next"> found on any page.',
      '<link rel="prev"> and <link rel="next"> in head',
      'Not found',
      {
        priority: 'low',
        description:
          'AI crawlers use rel="prev" and rel="next" to navigate paginated content series sequentially. Without these links, agents may miss pages in a series or index paginated listings out of order, leading to incomplete content coverage in AI knowledge bases.',
        code: '<link rel="prev" href="/blog/page/1">\n<link rel="next" href="/blog/page/3">',
      },
      page.url,
    );
  }
}
