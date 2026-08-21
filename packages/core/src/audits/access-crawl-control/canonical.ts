import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';

export class CanonicalLinksAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'access-crawl-control/canonical',
    category: 'access-crawl-control',
    title: 'Canonical links present',
    failureTitle: 'Canonical links present',
    description:
      'Canonical link tags tell AI crawlers which URL is the authoritative version of a page, preventing duplicate content issues.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/access-crawl-control/canonical.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Without canonical tags, AI crawlers may index duplicate versions of your pages (www vs non-www, HTTP vs HTTPS, trailing slash variants), diluting your content authority and causing inconsistent answers in AI search results.',
      fix: 'Add a <link rel="canonical"> tag to the <head> of every page pointing to the preferred URL. Ensure canonical URLs are absolute and consistent across all page variants.',
      code: '<link rel="canonical" href="https://yoursite.com/page" />',
      effort: 'easy',
      docsUrl:
        'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls',
      tags: ['canonical', 'seo', 'discoverability'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    if (ctx.pages.length === 0) {
      return this.fail(
        'No pages scanned.',
        'All pages have <link rel="canonical">',
        'No pages scanned',
        {
          priority: 'medium',
          description: CanonicalLinksAudit.meta.description,
        },
      );
    }

    const pagesWithoutCanonical: string[] = [];

    for (const page of ctx.pages) {
      const $ = page.$;
      const canonical = $('link[rel="canonical"]').attr('href');
      if (!canonical) {
        pagesWithoutCanonical.push(page.url);
      }
    }

    if (pagesWithoutCanonical.length === ctx.pages.length) {
      return this.fail(
        'No scanned pages have canonical link tags.',
        'All pages have <link rel="canonical">',
        `${pagesWithoutCanonical.length}/${ctx.pages.length} pages missing canonical`,
        {
          priority: 'medium',
          description:
            'None of your scanned pages have canonical link tags. Without them, AI crawlers may index duplicate versions of your pages (www vs non-www, HTTP vs HTTPS, with/without trailing slash).',
          code: `<link rel="canonical" href="https://yoursite.com/page" />`,
        },
        pagesWithoutCanonical[0],
      );
    }

    if (pagesWithoutCanonical.length > 0) {
      return this.warn(
        `${pagesWithoutCanonical.length}/${ctx.pages.length} page(s) missing canonical link tags.`,
        'All pages have <link rel="canonical">',
        `Missing on: ${pagesWithoutCanonical.slice(0, 5).join(', ')}${pagesWithoutCanonical.length > 5 ? ` (+${pagesWithoutCanonical.length - 5} more)` : ''}`,
        {
          priority: 'low',
          description:
            'Some pages are missing canonical link tags. Adding them prevents AI crawlers from indexing duplicate versions of your content.',
          code: `<link rel="canonical" href="https://yoursite.com/page" />`,
        },
        pagesWithoutCanonical[0],
      );
    }

    return this.pass(
      `All ${ctx.pages.length} page(s) have canonical link tags.`,
      'All pages have <link rel="canonical">',
      `${ctx.pages.length} page(s) with canonical`,
    );
  }
}
