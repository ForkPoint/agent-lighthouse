import * as cheerio from 'cheerio';
import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import type { FetchResult } from '../../fetcher';

function isOk(result: FetchResult): boolean {
  return result.status === 200;
}

/** Try to find the sitemap FetchResult from rootFiles, checking /sitemap.xml first then /sitemap-index.xml */
function getSitemapResult(ctx: CheckContext): FetchResult | null {
  const sitemap = ctx.rootFiles['/sitemap.xml'];
  if (sitemap && isOk(sitemap)) return sitemap;
  const index = ctx.rootFiles['/sitemap-index.xml'];
  if (index && isOk(index)) return index;
  return null;
}

export class SitemapLastmodAudit extends Audit {
  static override meta: AuditMeta = {
    id: '1.10',
    category: 'content-discoverability',
    title: 'Sitemap has lastmod dates',
    failureTitle: 'Sitemap has lastmod dates',
    description:
      'AI crawlers use <lastmod> to decide which pages to re-index and which to skip. Without these dates, crawlers must re-fetch every page on every visit.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Without <lastmod> dates, AI crawlers must re-fetch every page on every visit because they cannot tell which pages have changed. This wastes crawl budget and delays indexing of your freshest content.',
      fix: 'Add accurate <lastmod> dates to every <url> entry in your sitemap.xml. Update the date whenever the page content actually changes. Use ISO 8601 format (YYYY-MM-DD or full datetime).',
      code: '<url>\n  <loc>https://yoursite.com/page</loc>\n  <lastmod>2026-01-15</lastmod>\n</url>',
      effort: 'easy',
      docsUrl: 'https://www.sitemaps.org/protocol.html',
      tags: ['sitemap', 'seo', 'discoverability'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const sitemapResult = getSitemapResult(ctx);

    if (!sitemapResult) {
      return this.fail(
        'No sitemap found; cannot check lastmod.',
        'At least 80% of <url> entries have <lastmod>',
        'Sitemap not found',
        {
          priority: 'critical',
          description:
            'First, create your sitemap.xml file (see check 1.7). The <lastmod> dates help AI crawlers prioritize fresh content and skip pages they have already indexed.',
          code: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://yoursite.com/</loc>\n    <lastmod>2026-01-01</lastmod>\n    <priority>1.0</priority>\n  </url>\n</urlset>`,
        },
      );
    }

    const $ = cheerio.load(sitemapResult.body, { xmlMode: true });
    const urls = $('url');
    const total = urls.length;

    if (total === 0) {
      return this.warn(
        'Sitemap has no <url> entries.',
        'At least 80% with <lastmod>',
        'No <url> entries',
        {
          priority: 'high',
          description:
            'Your sitemap exists but contains no <url> entries. Add at least your main pages so AI crawlers can discover them.',
          code: `<url>\n  <loc>https://yoursite.com/</loc>\n  <lastmod>2026-01-01</lastmod>\n</url>`,
        },
      );
    }

    let withLastmod = 0;
    urls.each((_, el) => {
      if ($(el).find('lastmod').length > 0) withLastmod++;
    });

    const ratio = withLastmod / total;

    if (ratio < 0.8) {
      return this.fail(
        `Only ${Math.round(ratio * 100)}% of URL entries have <lastmod> (${withLastmod}/${total}).`,
        'At least 80% of <url> entries have <lastmod>',
        `${withLastmod}/${total} (${Math.round(ratio * 100)}%)`,
        {
          priority: 'medium',
          description:
            'AI crawlers use <lastmod> to decide which pages to re-index and which to skip. Without these dates, crawlers must re-fetch every page on every visit, wasting bandwidth and slowing indexing.',
          code: `<url>\n  <loc>https://yoursite.com/page</loc>\n  <lastmod>2026-01-15</lastmod>\n</url>`,
        },
      );
    }

    return this.pass(
      `${Math.round(ratio * 100)}% of URL entries have <lastmod>.`,
      '>= 80% with <lastmod>',
      `${withLastmod}/${total} (${Math.round(ratio * 100)}%)`,
    );
  }
}
