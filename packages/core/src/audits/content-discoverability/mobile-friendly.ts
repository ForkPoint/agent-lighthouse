import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

export class MobileFriendlyAudit extends Audit {
  static override meta: AuditMeta = {
    id: '1.18',
    category: 'content-discoverability',
    title: 'Mobile friendly',
    failureTitle: 'Mobile friendly',
    description:
      'A viewport meta tag signals mobile-friendliness. AI crawlers may prioritize mobile-friendly content, and many AI-powered searches originate from mobile devices.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI crawlers and search engines may deprioritize pages without a viewport meta tag. Since many AI-powered searches originate from mobile devices, non-mobile-friendly pages rank lower and deliver a poor experience.',
      fix: 'Add a viewport meta tag to the <head> of every page. This is typically a one-line addition to your HTML template or layout component.',
      code: '<meta name="viewport" content="width=device-width, initial-scale=1" />',
      effort: 'trivial',
      docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Viewport_meta_tag',
      tags: ['mobile', 'seo', 'discoverability'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    if (ctx.pages.length === 0) {
      return this.fail(
        'No pages scanned.',
        'Pages have <meta name="viewport"> tag',
        'No pages scanned',
        {
          priority: 'medium',
          description: MobileFriendlyAudit.meta.description,
        },
      );
    }

    const pagesWithoutViewport: string[] = [];

    for (const page of ctx.pages) {
      const viewport = page.meta['viewport'];
      if (!viewport) {
        pagesWithoutViewport.push(page.url);
      }
    }

    if (pagesWithoutViewport.length === ctx.pages.length) {
      return this.fail(
        'No scanned pages have a viewport meta tag.',
        'All pages have <meta name="viewport">',
        `${pagesWithoutViewport.length}/${ctx.pages.length} pages missing viewport`,
        {
          priority: 'medium',
          description:
            'None of your scanned pages have a viewport meta tag. Without it, pages are not mobile-friendly, which can negatively impact ranking in AI search results.',
          code: `<meta name="viewport" content="width=device-width, initial-scale=1" />`,
        },
        pagesWithoutViewport[0],
      );
    }

    if (pagesWithoutViewport.length > 0) {
      return this.warn(
        `${pagesWithoutViewport.length}/${ctx.pages.length} page(s) missing viewport meta tag.`,
        'All pages have <meta name="viewport">',
        `Missing on: ${pagesWithoutViewport.slice(0, 5).join(', ')}${pagesWithoutViewport.length > 5 ? ` (+${pagesWithoutViewport.length - 5} more)` : ''}`,
        {
          priority: 'low',
          description:
            'Some pages are missing the viewport meta tag. Adding it ensures they display correctly on mobile and are considered mobile-friendly by AI crawlers.',
          code: `<meta name="viewport" content="width=device-width, initial-scale=1" />`,
        },
        pagesWithoutViewport[0],
      );
    }

    return this.pass(
      `All ${ctx.pages.length} page(s) have a viewport meta tag.`,
      'All pages have <meta name="viewport">',
      `${ctx.pages.length} page(s) with viewport`,
    );
  }
}
