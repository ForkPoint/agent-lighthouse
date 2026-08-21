// TODO(merge): folds into machine-discovery/discovery-index-coverage in Plan 4 (approved 2026-08-21).

import * as cheerio from 'cheerio';
import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
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
    id: 'machine-discovery/no-orphan-pages',
    category: 'machine-discovery',
    title: 'No orphan pages',
    failureTitle: 'No orphan pages',
    description:
      'Orphan pages are not listed in your sitemap or llms.txt, so AI crawlers may never discover them.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/machine-discovery/no-orphan-pages.md',
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
      $('url > loc, sitemap > loc, loc').each((_, el) => {
        const loc = $(el).text().trim();
        if (loc) {
          sitemapUrls.add(loc);
          try {
            const u = new URL(loc);
            u.search = '';
            u.hash = '';
            sitemapUrls.add(u.href);
          } catch {
            // ignore
          }
        }
      });
    }

    // Collect URLs listed in llms.txt
    const llmsUrls = new Set<string>();
    const llmsResult = ctx.rootFiles['/llms.txt'];
    if (llmsResult && isOk(llmsResult)) {
      const links = extractMarkdownLinks(llmsResult.body);
      for (const link of links) {
        try {
          const parsed = new URL(link.url, ctx.baseUrl);
          llmsUrls.add(parsed.href);
          parsed.search = '';
          parsed.hash = '';
          llmsUrls.add(parsed.href);
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
      let cleanUrl = pageUrl;
      try {
        const u = new URL(pageUrl);
        u.search = '';
        u.hash = '';
        cleanUrl = u.href;
      } catch {
        // keep pageUrl
      }

      // Normalize for comparison: try raw, clean, canonical with/without trailing slash
      const variants = [
        pageUrl,
        pageUrl.replace(/\/$/, ''),
        pageUrl + '/',
        cleanUrl,
        cleanUrl.replace(/\/$/, ''),
        cleanUrl + '/',
      ];

      const canonical = page.meta['canonical'] || page.meta['og:url'];
      if (canonical) {
        variants.push(canonical, canonical.replace(/\/$/, ''), canonical + '/');
      }

      const inSitemap = variants.some((v) => sitemapUrls.has(v));
      const inLlms = variants.some((v) => llmsUrls.has(v));

      // Check if covered by a sub-sitemap pattern in a sitemapindex
      let inSitemapIndexPattern = false;
      if (sitemapResult && (sitemapResult.body.includes('<sitemapindex') || sitemapResult.body.includes('<sitemap>'))) {
        try {
          const path = new URL(pageUrl).pathname.toLowerCase();
          if (
            (path.startsWith('/products') && sitemapResult.body.includes('sitemap_products')) ||
            (path.startsWith('/collections') && sitemapResult.body.includes('sitemap_collections')) ||
            (path.startsWith('/pages') && sitemapResult.body.includes('sitemap_pages')) ||
            (path.startsWith('/blogs') && sitemapResult.body.includes('sitemap_blogs')) ||
            (path.startsWith('/posts') && sitemapResult.body.includes('sitemap_posts')) ||
            (path.startsWith('/docs') && sitemapResult.body.includes('sitemap_docs'))
          ) {
            inSitemapIndexPattern = true;
          }
        } catch {
          // ignore
        }
      }

      if (!inSitemap && !inLlms && !inSitemapIndexPattern) {
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
