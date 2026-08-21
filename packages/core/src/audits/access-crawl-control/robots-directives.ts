import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';

export class MetaRobotsNotBlockingAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'access-crawl-control/robots-directives',
    category: 'access-crawl-control',
    title: '<meta name="robots"> not blocking',
    failureTitle: '<meta name="robots"> not blocking',
    description:
      'Pages with <meta name="robots" content="noindex"> are hidden from all search engines, including AI-powered ones. Ensure your important content pages do not have this tag.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/access-crawl-control/robots-directives.md',
    defaultPriority: 'high',
    guidance: {
      impact:
        'Pages with <meta name="robots" content="noindex"> are hidden from all search engines, including AI-powered ones. These pages will not appear in AI search results or be referenced by AI assistants, making their content effectively invisible.',
      fix: 'Remove the noindex directive from pages you want AI agents to discover. Replace with "index, follow" or remove the meta robots tag entirely.',
      code: '<meta name="robots" content="index, follow">',
      effort: 'trivial',
      tags: ['meta-tags', 'indexing', 'crawler-permissions'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    if (!ctx.pages || ctx.pages.length === 0) {
      return this.warn(
        'No pages were scanned to check meta robots tags.',
        'No noindex directive on primary content pages',
        'No pages scanned',
        {
          priority: 'low',
          description:
            'Pages with <meta name="robots" content="noindex"> are hidden from all search engines, including AI-powered ones. Ensure your important content pages do not have this tag.',
          code: '<meta name="robots" content="index, follow">',
        },
      );
    }

    const blockedPages: string[] = [];

    for (const page of ctx.pages) {
      const robotsContent = (page.meta['robots'] ?? '').toLowerCase();
      if (robotsContent.includes('noindex')) {
        blockedPages.push(page.url);
      }
    }

    if (blockedPages.length === 0) {
      return this.pass(
        'No scanned pages have a <meta name="robots"> tag with noindex.',
        'No noindex directive on primary content pages',
        `Checked ${ctx.pages.length} page(s) — none have noindex`,
      );
    }

    return this.fail(
      `${blockedPages.length} page(s) have <meta name="robots" content="noindex">, blocking AI crawlers from indexing.`,
      'No noindex directive on primary content pages',
      `Pages with noindex: ${blockedPages.join(', ')}`,
      {
        priority: 'high',
        description:
          'The noindex directive on these pages prevents AI crawlers from indexing the content. This means the pages will not appear in AI search results or be referenced by AI assistants. Remove the noindex tag from pages you want AI agents to discover.',
        code: '<!-- Replace noindex with: -->\n<meta name="robots" content="index, follow">',
      },
    );
  }
}
