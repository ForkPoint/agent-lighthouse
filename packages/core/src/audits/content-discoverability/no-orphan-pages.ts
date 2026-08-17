import * as cheerio from 'cheerio';
import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import type { FetchResult } from '../../fetcher';
import { extractMarkdownLinks } from '../../parser';

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

export class NoOrphanPagesAudit extends Audit {
  static override meta: AuditMeta = {
    id: '1.22',
    category: 'content-discoverability',
    title: 'No orphan pages',
    failureTitle: 'No orphan pages',
    description:
      'Orphan pages are not listed in your sitemap or llms.txt, so AI crawlers may never discover them.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Orphan pages are not referenced in your sitemap or llms.txt, so AI crawlers may never discover them. This means potentially valuable content -- product pages, blog posts, documentation -- remains invisible to AI-powered search.',
      fix: 'Add all important pages to your sitemap.xml and/or reference them in your llms.txt file. Run a crawl comparison periodically to catch pages that fall out of both indexes.',
      code: '<!-- Add to sitemap.xml -->\n<url>\n  <loc>https://yoursite.com/orphan-page</loc>\n  <lastmod>2026-01-01</lastmod>\n</url>\n\n# Or add to llms.txt\n- [Orphan Page](/orphan-page): Description of the page',
      effort: 'easy',
      tags: ['orphan-pages', 'sitemap', 'discoverability'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    // Collect all URLs listed in sitemap
    const sitemapUrls = new Set<string>();
    const sitemapResult = getSitemapResult(ctx);
    if (sitemapResult) {
      const $ = cheerio.load(sitemapResult.body, { xmlMode: true });
      $('url > loc').each((_, el) => {
        const loc = $(el).text().trim();
        if (loc) sitemapUrls.add(loc);
      });
    }

    // Collect URLs listed in llms.txt
    const llmsUrls = new Set<string>();
    const llmsResult = ctx.rootFiles['/llms.txt'];
    if (llmsResult && isOk(llmsResult)) {
      const links = extractMarkdownLinks(llmsResult.body);
      for (const link of links) {
        try {
          llmsUrls.add(new URL(link.url, ctx.baseUrl).href);
        } catch {
          // skip invalid URLs
        }
      }
    }

    if (sitemapUrls.size === 0 && llmsUrls.size === 0) {
      return this.warn(
        'No sitemap or llms.txt links to compare against scanned pages.',
        'All scanned pages appear in sitemap or llms.txt',
        'No sitemap URLs or llms.txt links found',
        {
          priority: 'medium',
          description:
            'Without a sitemap or llms.txt, AI crawlers have no reference list of your pages. Create at least one so we can verify all your pages are discoverable.',
          code: `Sitemap: https://yoursite.com/sitemap.xml`,
        },
      );
    }

    const orphans: string[] = [];
    for (const page of ctx.pages) {
      const pageUrl = page.url;
      // Normalize for comparison: try with and without trailing slash
      const variants = [pageUrl, pageUrl.replace(/\/$/, ''), pageUrl + '/'];
      const inSitemap = variants.some((v) => sitemapUrls.has(v));
      const inLlms = variants.some((v) => llmsUrls.has(v));
      if (!inSitemap && !inLlms) {
        orphans.push(pageUrl);
      }
    }

    if (orphans.length > 0) {
      return this.fail(
        `${orphans.length} scanned page(s) not found in sitemap or llms.txt.`,
        'All scanned pages appear in sitemap or llms.txt',
        `Orphan pages: ${orphans.slice(0, 5).join(', ')}${orphans.length > 5 ? ` (+${orphans.length - 5} more)` : ''}`,
        {
          priority: 'medium',
          description:
            'Orphan pages are not listed in your sitemap or llms.txt, so AI crawlers may never discover them. Add these pages to your sitemap.xml or reference them in llms.txt to ensure complete coverage.',
          code: `<!-- Add to sitemap.xml -->\n<url>\n  <loc>https://yoursite.com/orphan-page</loc>\n  <lastmod>2026-01-01</lastmod>\n</url>`,
        },
      );
    }

    return this.pass(
      `All ${ctx.pages.length} scanned page(s) are in the sitemap or llms.txt.`,
      'No orphan pages',
      `${ctx.pages.length} page(s) accounted for`,
    );
  }
}
