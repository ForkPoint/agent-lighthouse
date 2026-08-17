import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

export class CanonicalUrlAudit extends Audit {
  static override meta: AuditMeta = {
    id: '4.3',
    category: 'meta-tags',
    title: 'Canonical URL set',
    failureTitle: 'Canonical URL set',
    description:
      'AI crawlers use canonical URLs to deduplicate content and determine the authoritative version of a page. Without a canonical tag, agents may index multiple URL variants of the same content, diluting your page authority in AI knowledge bases.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'high',
    guidance: {
      impact:
        'AI crawlers use canonical URLs to deduplicate content and determine the authoritative version of a page. Without a canonical tag, agents may index multiple URL variants, diluting your page authority in AI knowledge bases.',
      fix: 'Add a <link rel="canonical"> tag in <head> with the full absolute URL (starting with https://) of the preferred version of each page.',
      code: '<link rel="canonical" href="https://example.com/page">',
      effort: 'trivial',
      docsUrl:
        'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls',
      tags: ['meta-tags', 'seo', 'deduplication'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    const canonical = page?.headLinks?.find((l) => l.rel === 'canonical');
    const href = canonical?.href ?? '';

    if (href.startsWith('http')) {
      return this.pass(
        `Canonical URL is set to "${href}".`,
        '<link rel="canonical"> with an absolute URL starting with http',
        href,
        page.url,
      );
    }

    if (href) {
      return this.warn(
        `Canonical URL is present but not absolute: "${href}".`,
        '<link rel="canonical"> with an absolute URL starting with http',
        href,
        {
          priority: 'high',
          description:
            'AI crawlers use canonical URLs to deduplicate content and determine the authoritative version of a page. A relative canonical URL is ambiguous and may cause agents to index duplicate content or miss your preferred URL entirely.',
          code: '<link rel="canonical" href="https://example.com/page">',
        },
        page?.url,
      );
    }

    return this.fail(
      'No canonical URL found.',
      '<link rel="canonical"> with an absolute URL starting with http',
      'Not found',
      {
        priority: 'high',
        description:
          'AI crawlers use canonical URLs to deduplicate content and determine the authoritative version of a page. Without a canonical tag, agents may index multiple URL variants of the same content, diluting your page authority in AI knowledge bases.',
        code: '<link rel="canonical" href="https://example.com/page">',
      },
      page?.url,
    );
  }
}
