import * as cheerio from 'cheerio';
import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
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

export class SitemapKeyPagesAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'machine-discovery/discovery-index-coverage',
    category: 'machine-discovery',
    title: 'Sitemap includes all key pages',
    failureTitle: 'Sitemap includes all key pages',
    description:
      'The sitemap should include all scanned pages so AI crawlers can discover your full site content.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier: 'docs/evidence/audits/machine-discovery/discovery-index-coverage.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Pages missing from your sitemap may not be discovered by AI crawlers, even if they exist on your site. This means important content -- product pages, documentation, blog posts -- could be absent from AI search results.',
      fix: 'Ensure your sitemap.xml includes all important pages. Compare your sitemap against your actual site pages and add any missing URLs. Configure your CMS or build tool to auto-include new pages in the sitemap.',
      code: '<url>\n  <loc>https://yoursite.com/missing-page</loc>\n  <lastmod>2026-01-01</lastmod>\n</url>',
      effort: 'easy',
      docsUrl: 'https://www.sitemaps.org/protocol.html',
      tags: ['sitemap', 'seo', 'discoverability'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const sitemapResult = getSitemapResult(ctx);

    if (!sitemapResult) {
      return this.fail(
        'No sitemap found; cannot check key page coverage.',
        'All scanned pages appear in sitemap',
        'Sitemap not found',
        {
          priority: 'critical',
          description:
            'First, create your sitemap.xml file (see check 1.7). The sitemap should list all your important pages so AI crawlers can discover them.',
          code: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://yoursite.com/</loc>\n    <lastmod>2026-01-01</lastmod>\n  </url>\n</urlset>`,
        },
      );
    }

    const $ = cheerio.load(sitemapResult.body, { xmlMode: true });

    // Handle sitemap index files (<sitemapindex>)
    const isSitemapIndex = $('sitemapindex').length > 0 || $('sitemap > loc').length > 0;
    if (isSitemapIndex) {
      const subSitemaps: string[] = [];
      $('sitemap > loc').each((_, el) => {
        const loc = $(el).text().trim();
        if (loc) subSitemaps.push(loc);
      });
      return this.pass(
        `Sitemap index file found linking to ${subSitemaps.length} sub-sitemap(s).`,
        'All scanned pages appear in sitemap or sitemap index',
        `Sitemap Index (${subSitemaps.length} sub-sitemaps)`,
      );
    }

    const sitemapUrls = new Set<string>();
    $('url > loc').each((_, el) => {
      const loc = $(el).text().trim();
      if (loc) sitemapUrls.add(loc);
    });

    if (sitemapUrls.size === 0) {
      return this.warn(
        'Sitemap has no <url> entries.',
        'All scanned pages appear in sitemap',
        'No <url> entries',
        {
          priority: 'high',
          description:
            'Your sitemap exists but contains no <url> entries. Add at least your main pages so AI crawlers can discover them.',
          code: `<url>\n  <loc>https://yoursite.com/</loc>\n  <lastmod>2026-01-01</lastmod>\n</url>`,
        },
      );
    }

    const missing: string[] = [];
    for (const page of ctx.pages) {
      const pageUrl = page.url;
      const variants = [pageUrl, pageUrl.replace(/\/$/, ''), pageUrl + '/'];
      const inSitemap = variants.some((v) => sitemapUrls.has(v));
      if (!inSitemap) {
        missing.push(pageUrl);
      }
    }

    if (missing.length > 0) {
      const ratio = missing.length / ctx.pages.length;
      if (ratio > 0.5) {
        return this.fail(
          `${missing.length}/${ctx.pages.length} scanned page(s) missing from sitemap.`,
          'All scanned pages appear in sitemap',
          `Missing: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ` (+${missing.length - 5} more)` : ''}`,
          {
            priority: 'medium',
            description:
              'Many of your scanned pages are not listed in the sitemap. AI crawlers rely on the sitemap to discover pages. Add all important pages to ensure complete indexing.',
            code: `<url>\n  <loc>https://yoursite.com/missing-page</loc>\n  <lastmod>2026-01-01</lastmod>\n</url>`,
          },
        );
      }
      return this.warn(
        `${missing.length}/${ctx.pages.length} scanned page(s) missing from sitemap.`,
        'All scanned pages appear in sitemap',
        `Missing: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ` (+${missing.length - 5} more)` : ''}`,
        {
          priority: 'low',
          description:
            'Some scanned pages are not listed in the sitemap. Adding them helps AI crawlers discover all your content.',
          code: `<url>\n  <loc>https://yoursite.com/missing-page</loc>\n  <lastmod>2026-01-01</lastmod>\n</url>`,
        },
      );
    }

    return this.pass(
      `All ${ctx.pages.length} scanned page(s) found in the sitemap.`,
      'All scanned pages appear in sitemap',
      `${ctx.pages.length} page(s) found`,
    );
  }
}
