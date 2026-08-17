import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

export class InternalLinkingAudit extends Audit {
  static override meta: AuditMeta = {
    id: '1.15',
    category: 'content-discoverability',
    title: 'Internal linking structure',
    failureTitle: 'Internal linking structure',
    description:
      'A strong internal linking structure helps AI crawlers discover and understand the relationships between your pages.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Without internal links, AI crawlers cannot discover related pages or understand how your content is organized. This limits the depth of your site that gets indexed and weakens topical authority in AI search results.',
      fix: 'Add contextual internal links between related pages. Use descriptive anchor text that tells AI crawlers what the linked page is about. Aim for at least 3-5 internal links per page.',
      code: '<a href="/related-page">Learn more about related topic</a>',
      effort: 'easy',
      tags: ['internal-links', 'seo', 'discoverability'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    if (ctx.pages.length === 0) {
      return this.fail(
        'No pages scanned.',
        'Pages have internal links to other pages on the same domain',
        'No pages scanned',
        {
          priority: 'medium',
          description: InternalLinkingAudit.meta.description,
        },
      );
    }

    const domain = ctx.domain;
    let totalInternalLinks = 0;
    const pagesWithNoInternalLinks: string[] = [];

    for (const page of ctx.pages) {
      const $ = page.$;
      let pageInternalLinks = 0;

      $('a[href]').each((_, el) => {
        /* v8 ignore next -- a[href] selector guarantees attr is always a string */
        const href = $(el).attr('href') ?? '';
        try {
          const resolved = new URL(href, page.url);
          if (resolved.hostname === domain || resolved.hostname.endsWith(`.${domain}`)) {
            pageInternalLinks++;
          }
        } catch {
          // Relative URLs that fail to parse are likely internal
          if (
            href.startsWith('/') ||
            href.startsWith('#') ||
            href.startsWith('./') ||
            href.startsWith('../')
          ) {
            pageInternalLinks++;
          }
        }
      });

      totalInternalLinks += pageInternalLinks;
      if (pageInternalLinks === 0) {
        pagesWithNoInternalLinks.push(page.url);
      }
    }

    if (pagesWithNoInternalLinks.length === ctx.pages.length) {
      return this.fail(
        'No scanned pages have internal links.',
        'Pages have internal links to other pages',
        `${totalInternalLinks} internal links across ${ctx.pages.length} page(s)`,
        {
          priority: 'medium',
          description:
            'None of your scanned pages contain internal links. Internal links help AI crawlers discover related content and understand your site structure. Add links between related pages.',
          code: `<a href="/related-page">Related content</a>`,
        },
        pagesWithNoInternalLinks[0],
      );
    }

    if (pagesWithNoInternalLinks.length > 0) {
      return this.warn(
        `${pagesWithNoInternalLinks.length}/${ctx.pages.length} page(s) have no internal links.`,
        'All pages have internal links',
        `Pages without links: ${pagesWithNoInternalLinks.slice(0, 5).join(', ')}${pagesWithNoInternalLinks.length > 5 ? ` (+${pagesWithNoInternalLinks.length - 5} more)` : ''}`,
        {
          priority: 'low',
          description:
            'Some pages lack internal links, making them harder for AI crawlers to connect to the rest of your site. Add contextual links to related content.',
          code: `<a href="/related-page">Related content</a>`,
        },
        pagesWithNoInternalLinks[0],
      );
    }

    const avgLinks = Math.round(totalInternalLinks / ctx.pages.length);
    return this.pass(
      `All ${ctx.pages.length} page(s) have internal links (avg ${avgLinks} per page).`,
      'All pages have internal links',
      `${totalInternalLinks} total internal links`,
    );
  }
}
