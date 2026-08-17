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

export class SitemapAbsoluteUrlsAudit extends Audit {
  static override meta: AuditMeta = {
    id: '1.9',
    category: 'content-discoverability',
    title: 'Sitemap uses absolute URLs',
    failureTitle: 'Sitemap uses absolute URLs',
    description:
      'Sitemap URLs must be absolute (starting with https://) so AI crawlers can resolve them without ambiguity.',
    scoreDisplayMode: 'binary',
    weight: 1.0,
    defaultPriority: 'high',
    guidance: {
      impact:
        'Relative URLs in your sitemap cannot be resolved by AI crawlers, causing them to silently skip those pages. Any page listed with a relative URL is effectively invisible to AI search engines.',
      fix: 'Ensure every <loc> value in your sitemap.xml starts with the full protocol and domain (e.g., https://yoursite.com/page). Update your sitemap generator configuration to output absolute URLs.',
      code: '<!-- Correct: absolute URL -->\n<url>\n  <loc>https://yoursite.com/page</loc>\n</url>\n\n<!-- Wrong: relative URL -->\n<url>\n  <loc>/page</loc>\n</url>',
      effort: 'trivial',
      docsUrl: 'https://www.sitemaps.org/protocol.html',
      tags: ['sitemap', 'seo', 'discoverability'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const sitemapResult = getSitemapResult(ctx);

    if (!sitemapResult) {
      return this.fail(
        'No sitemap found; cannot check URL format.',
        'All <loc> values are absolute URLs',
        'Sitemap not found',
        {
          priority: 'critical',
          description:
            'First, create your sitemap.xml file (see check 1.7). All URLs in the sitemap must be absolute so AI crawlers can resolve them.',
          code: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://yoursite.com/page</loc>\n  </url>\n</urlset>`,
        },
      );
    }

    const $ = cheerio.load(sitemapResult.body, { xmlMode: true });
    const locs: string[] = [];
    $('url > loc').each((_, el) => {
      const loc = $(el).text().trim();
      if (loc) locs.push(loc);
    });

    if (locs.length === 0) {
      return this.fail(
        'Sitemap has no <loc> entries to check.',
        'All <loc> values are absolute URLs',
        'No <loc> entries found',
        {
          priority: 'high',
          description: 'Your sitemap has no <loc> entries. Add absolute URLs for all your pages.',
          code: `<url>\n  <loc>https://yoursite.com/page</loc>\n</url>`,
        },
      );
    }

    const relative = locs.filter(
      (loc) => !loc.startsWith('http://') && !loc.startsWith('https://'),
    );

    if (relative.length > 0) {
      return this.fail(
        `${relative.length}/${locs.length} <loc> value(s) use relative URLs.`,
        'All <loc> values are absolute URLs (https://...)',
        `Relative: ${relative.slice(0, 5).join(', ')}${relative.length > 5 ? ` (+${relative.length - 5} more)` : ''}`,
        {
          priority: 'high',
          description:
            'Sitemap URLs must be absolute (starting with http:// or https://) per the sitemaps.org protocol. Relative URLs cannot be resolved by AI crawlers and will be ignored.',
          code: `<!-- Use absolute URLs -->\n<url>\n  <loc>https://yoursite.com/page</loc>\n</url>\n\n<!-- NOT relative URLs -->\n<url>\n  <loc>/page</loc> <!-- WRONG -->\n</url>`,
        },
      );
    }

    return this.pass(
      `All ${locs.length} <loc> value(s) use absolute URLs.`,
      'All <loc> values are absolute URLs',
      `${locs.length} absolute URL(s)`,
    );
  }
}
