import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

export class NoNoindexAudit extends Audit {
  static override meta: AuditMeta = {
    id: '1.13',
    category: 'content-discoverability',
    title: 'No noindex on homepage',
    failureTitle: 'No noindex on homepage',
    description:
      'A noindex directive on your homepage prevents AI crawlers and search engines from indexing your most important page.',
    scoreDisplayMode: 'binary',
    weight: 1.0,
    defaultPriority: 'critical',
    guidance: {
      impact:
        'A noindex directive on your homepage completely blocks AI crawlers and search engines from indexing your most important page. Your site becomes invisible in AI search results, causing total loss of organic AI-driven traffic.',
      fix: 'Remove the noindex directive from your homepage by updating the meta robots tag to "index, follow" and removing any X-Robots-Tag: noindex header from your server configuration.',
      code: '<!-- Remove noindex from homepage -->\n<meta name="robots" content="index, follow" />',
      effort: 'trivial',
      docsUrl: 'https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag',
      tags: ['robots', 'seo', 'discoverability'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    if (!page) {
      return this.fail(
        'No pages scanned.',
        'Homepage has no noindex meta tag or X-Robots-Tag header',
        'No pages scanned',
        {
          priority: 'critical',
          description: NoNoindexAudit.meta.description,
        },
      );
    }

    // Check meta robots tag
    const metaRobots = (page.meta['robots'] ?? '').toLowerCase();
    const hasMetaNoindex = metaRobots.includes('noindex');

    // Check X-Robots-Tag header
    const xRobotsTag = (page.fetchResult.headers['x-robots-tag'] ?? '').toLowerCase();
    const hasHeaderNoindex = xRobotsTag.includes('noindex');

    if (hasMetaNoindex || hasHeaderNoindex) {
      const sources: string[] = [];
      if (hasMetaNoindex) sources.push(`meta robots="${page.meta['robots']}"`);
      if (hasHeaderNoindex)
        sources.push(`X-Robots-Tag: ${page.fetchResult.headers['x-robots-tag']}`);
      return this.fail(
        `Homepage has noindex directive: ${sources.join(', ')}.`,
        'No noindex on homepage',
        sources.join('; '),
        {
          priority: 'critical',
          description:
            'A noindex directive on your homepage blocks AI crawlers and search engines from indexing it. Remove the noindex from your homepage to ensure it appears in AI search results.',
          code: `<!-- Remove noindex from homepage -->\n<meta name="robots" content="index, follow" />`,
        },
        page.url,
      );
    }

    return this.pass(
      'Homepage has no noindex directive.',
      'No noindex on homepage',
      'No noindex found',
      page.url,
    );
  }
}
