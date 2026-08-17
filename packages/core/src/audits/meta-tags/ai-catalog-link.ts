import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

export class AiCatalogLinkAudit extends Audit {
  static override meta: AuditMeta = {
    id: '4.19',
    category: 'meta-tags',
    title: 'AI Catalog link in head',
    failureTitle: 'AI Catalog link in head',
    description:
      'The AI Catalog provides a structured manifest of all AI-consumable resources on your site (APIs, datasets, tools). An AI Catalog link in <head> lets agents discover your full range of machine-readable content in a single request instead of crawling your entire site.',
    scoreDisplayMode: 'binary',
    weight: 1.0,
    defaultPriority: 'low',
    guidance: {
      impact:
        'Without an AI Catalog link, agents must crawl your entire site to discover AI-consumable resources (APIs, datasets, tools). The catalog lets them find everything in a single request, dramatically improving discovery efficiency.',
      fix: 'Create an AI Catalog JSON file listing your AI-consumable resources and add a <link rel="alternate"> tag in <head> pointing to it.',
      code: '<link rel="alternate" type="application/json" href="/ai-catalog.json" title="AI Catalog">',
      effort: 'moderate',
      tags: ['meta-tags', 'ai-catalog', 'ai-discovery'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    /* v8 ignore start */
    const link = page?.headLinks?.find(
      (l) =>
        l.rel === 'alternate' &&
        l.type === 'application/json' &&
        (l.title ?? '').toLowerCase().includes('ai catalog'),
    );
    /* v8 ignore stop */

    if (link) {
      return this.pass(
        `AI Catalog link found: "${link.href}".`,
        '<link rel="alternate" type="application/json" title="...AI Catalog...">',
        `href="${link.href}" title="${link.title}"`,
        page.url,
      );
    }

    return this.fail(
      'No AI Catalog link found in <head>.',
      '<link rel="alternate" type="application/json" title="...AI Catalog...">',
      'Not found',
      {
        priority: 'low',
        description:
          'The AI Catalog provides a structured manifest of all AI-consumable resources on your site (APIs, datasets, tools). An AI Catalog link in <head> lets agents discover your full range of machine-readable content in a single request instead of crawling your entire site.',
        code: '<link rel="alternate" type="application/json" href="/ai-catalog.json" title="AI Catalog">',
      },
      page?.url,
    );
  }
}
