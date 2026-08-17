import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

export class PreconnectHintsAudit extends Audit {
  static override meta: AuditMeta = {
    id: '8.17',
    category: 'technical-readiness',
    title: 'Preconnect hints',
    failureTitle: 'Preconnect hints',
    description:
      'Preconnect hints reduce the time AI crawlers spend establishing connections to third-party resources. Faster page loads mean AI agents can crawl more of your pages within their time budget, improving overall content coverage in AI knowledge bases.',
    scoreDisplayMode: 'binary',
    weight: 1.0,
    defaultPriority: 'low',
    guidance: {
      impact:
        'Without preconnect hints, each third-party resource requires a full DNS lookup, TCP handshake, and TLS negotiation before loading can begin. This adds hundreds of milliseconds per origin, slowing overall page load and reducing the number of pages AI crawlers can process within their time budget.',
      fix: 'Add <link rel="preconnect"> tags in <head> for your most critical third-party origins (CDNs, font providers, analytics). Limit to 2-4 origins to avoid diminishing returns.',
      code: '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://cdn.yoursite.com" crossorigin>',
      effort: 'trivial',
      docsUrl: 'https://web.dev/articles/uses-rel-preconnect',
      tags: ['performance', 'speed', 'resource-hints'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages?.[0];

    if (!page) {
      return this.warn(
        'No homepage data available to check preconnect hints.',
        'At least one <link rel="preconnect"> tag present',
        'No homepage fetched',
        undefined,
        undefined,
      );
    }

    const $ = page.$;
    const preconnects = $('link[rel="preconnect"]');

    if (preconnects.length > 0) {
      const hrefs: string[] = [];
      preconnects.each((_, el) => {
        const href = $(el).attr('href');
        if (href) hrefs.push(href);
      });

      return this.pass(
        `Found ${preconnects.length} preconnect hint(s): ${hrefs.slice(0, 5).join(', ')}`,
        'At least one <link rel="preconnect"> tag present',
        `${preconnects.length} preconnect hint(s)`,
        page.url,
      );
    }

    return this.fail(
      'No <link rel="preconnect"> hints found. Preconnect hints speed up connections to critical third-party origins.',
      'At least one <link rel="preconnect"> tag present',
      'No preconnect hints found',
      {
        priority: 'low',
        description:
          'Preconnect hints reduce the time AI crawlers spend establishing connections to third-party resources. Faster page loads mean AI agents can crawl more of your pages within their time budget, improving overall content coverage in AI knowledge bases.',
        code: '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://cdn.yoursite.com">',
      },
      page.url,
    );
  }
}
