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

export class SitemapExistsAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'machine-discovery/sitemap-exists',
    category: 'machine-discovery',
    title: 'sitemap.xml exists',
    failureTitle: 'sitemap.xml exists',
    description:
      'AI crawlers use your sitemap to discover all pages without following links. Without it, pages may never be indexed by AI search engines.',
    scoreDisplayMode: 'binary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/machine-discovery/sitemap-exists.md',
    defaultPriority: 'critical',
    guidance: {
      impact:
        'Without a sitemap, AI crawlers must discover your pages solely through link-following, which is slow and incomplete. Pages deep in your site hierarchy may never be found, meaning AI search engines like Perplexity and ChatGPT Browse cannot surface your full content.',
      fix: 'Create a sitemap.xml at your site root containing all important pages. Use a <urlset> with <url> entries for each page, including <loc> and <lastmod>. Most frameworks (Next.js, WordPress, etc.) can auto-generate sitemaps.',
      code: '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://yoursite.com/</loc>\n    <lastmod>2026-01-01</lastmod>\n    <priority>1.0</priority>\n  </url>\n</urlset>',
      effort: 'easy',
      docsUrl: 'https://www.sitemaps.org/protocol.html',
      tags: ['sitemap', 'seo', 'discoverability'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const sitemapResult = getSitemapResult(ctx);

    if (!sitemapResult) {
      return this.fail(
        'No XML sitemap found at /sitemap.xml or /sitemap-index.xml.',
        'HTTP 200 with valid XML containing <urlset> or <sitemapindex>',
        'Not found at either path',
        {
          priority: 'critical',
          description:
            'AI crawlers use your sitemap to discover all pages without following links. Without it, pages may never be indexed by AI search engines like Perplexity or ChatGPT Browse.',
          code: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://yoursite.com/</loc>\n    <lastmod>2026-01-01</lastmod>\n    <priority>1.0</priority>\n  </url>\n</urlset>`,
        },
      );
    }

    const $ = cheerio.load(sitemapResult.body, { xmlMode: true });
    const hasUrlset = $('urlset').length > 0;
    const hasSitemapindex = $('sitemapindex').length > 0;

    if (!hasUrlset && !hasSitemapindex) {
      return this.fail(
        'Sitemap file found but does not contain valid <urlset> or <sitemapindex>.',
        'Valid XML with <urlset> or <sitemapindex>',
        'No <urlset> or <sitemapindex> found in response',
        {
          priority: 'critical',
          description:
            'Your sitemap.xml file exists but lacks the required XML structure. AI crawlers cannot parse it without a valid <urlset> or <sitemapindex> root element. Ensure the file is well-formed XML.',
          code: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://yoursite.com/</loc>\n    <lastmod>2026-01-01</lastmod>\n  </url>\n</urlset>`,
        },
      );
    }

    return this.pass(
      'XML sitemap exists with valid structure.',
      'Valid <urlset> or <sitemapindex>',
      hasUrlset ? '<urlset> found' : '<sitemapindex> found',
    );
  }
}
