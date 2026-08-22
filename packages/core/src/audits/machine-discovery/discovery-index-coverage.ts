import * as cheerio from 'cheerio';
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import type { CheckContext, PageContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import type { FetchResult } from '../../fetcher';

function isOk(result: FetchResult): boolean {
  return result.status === 200;
}

/** Try to find the sitemap FetchResult, checking /sitemap.xml first then /sitemap-index.xml. */
function getSitemapResult(ctx: CheckContext): FetchResult | null {
  const sitemap = ctx.rootFiles['/sitemap.xml'];
  if (sitemap && isOk(sitemap)) return sitemap;
  const index = ctx.rootFiles['/sitemap-index.xml'];
  if (index && isOk(index)) return index;
  return null;
}

/** Sub-sitemaps fetched from a <sitemapindex> before the comparison. */
const MAX_SUB_SITEMAPS = 10;

/**
 * One comparison key for both sides of the coverage check.
 *
 * Raw string equality over trailing-slash variants produced phantom "missing"
 * pages whenever protocol, `www.`, case, percent-encoding or tracking query
 * params differed between the sitemap and the scanned URL (review findings 1.8
 * and 1.22). The key drops everything that cannot change which document is
 * served: scheme, `www.`, default port, query, fragment, trailing slash, case.
 */
function coverageKey(rawUrl: string, base?: string): string | null {
  try {
    const url = new URL(rawUrl, base);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    let path = decodeURI(url.pathname).replace(/\/+$/, '');
    path = path.toLowerCase();
    return `${host}${path}`;
  } catch {
    return null;
  }
}

/** Collect every <loc> of a sitemap or sitemap-index body. */
function locsOf(body: string, selector: string): string[] {
  const $ = cheerio.load(body, { xmlMode: true });
  const out: string[] = [];
  $(selector).each((_, el) => {
    const loc = $(el).text().trim();
    if (loc) out.push(loc);
  });
  return out;
}

/**
 * Markdown links from llms.txt, relative ones included.
 *
 * `parser.extractMarkdownLinks` keeps absolute URLs only, so a site listing its
 * pages as `- [About](/about)` looked like it had no llms.txt index at all
 * (review finding 1.22).
 */
function llmsTxtLinks(body: string): string[] {
  const out: string[] = [];
  const inline = /\[[^\]]+\]\(([^)\s]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = inline.exec(body)) !== null) out.push(match[1]!);
  const bullet = /^\s*(?:[-*+]|\d+\.)\s+(?:\*\*[^*]+\*\*[:\-—]?\s*)?(https?:\/\/\S+)/gm;
  while ((match = bullet.exec(body)) !== null) out.push(match[1]!);
  return out;
}

export class DiscoveryIndexCoverageAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'machine-discovery/discovery-index-coverage',
    category: 'machine-discovery',
    title: 'Pages are covered by a discovery index',
    failureTitle: 'Pages are covered by a discovery index',
    description:
      'Every scanned page should be listed in a discovery index — the sitemap (including its sub-sitemaps) or llms.txt — so AI crawlers can find it without relying on the link graph.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier: 'docs/evidence/audits/machine-discovery/discovery-index-coverage.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'A page listed in no discovery index is reachable only through the link graph, and the major AI crawlers do not execute JavaScript — so a page missing from both the sitemap and llms.txt can stay invisible to AI search even though it exists on your site.',
      fix: 'List every important page in sitemap.xml (or in one of the sub-sitemaps its index points at), and/or reference it from llms.txt. Configure your CMS or build tool to add new pages automatically.',
      code: '<!-- sitemap.xml -->\n<url>\n  <loc>https://yoursite.com/missing-page</loc>\n  <lastmod>2026-01-01</lastmod>\n</url>\n\n<!-- or llms.txt -->\n- [Missing Page](/missing-page): Description of the page',
      effort: 'easy',
      docsUrl: 'https://www.sitemaps.org/protocol.html',
      tags: ['sitemap', 'llms-txt', 'discoverability'],
    },
  };

  /** Every URL any discovery index lists, as comparison keys. */
  private async indexKeys(ctx: CheckContext): Promise<Set<string>> {
    const keys = new Set<string>();
    const add = (url: string, base?: string) => {
      const key = coverageKey(url, base);
      if (key) keys.add(key);
    };

    const sitemapResult = getSitemapResult(ctx);
    if (sitemapResult) {
      for (const loc of locsOf(sitemapResult.body, 'urlset > url > loc')) add(loc);

      // A <sitemapindex> lists no page URLs of its own. v1 short-circuited to a
      // pass here without reading one; the sub-sitemaps are fetched instead.
      const subSitemaps = locsOf(sitemapResult.body, 'sitemapindex > sitemap > loc').slice(
        0,
        MAX_SUB_SITEMAPS,
      );
      if (subSitemaps.length > 0) {
        const fetched = await Promise.all(
          subSitemaps.map((url) => ctx.fetch({ url }).catch(() => null)),
        );
        for (const sub of fetched) {
          if (!sub || !isOk(sub)) continue;
          for (const loc of locsOf(sub.body, 'urlset > url > loc')) add(loc);
        }
      }
    }

    const llmsResult = ctx.rootFiles['/llms.txt'];
    if (llmsResult && isOk(llmsResult)) {
      for (const link of llmsTxtLinks(llmsResult.body)) add(link, ctx.baseUrl);
    }

    return keys;
  }

  /** A page's own keys: its URL plus its declared canonical, if any. */
  private pageKeys(page: PageContext): string[] {
    const keys = [coverageKey(page.url)];
    // v1 read `page.meta['canonical']`, which extractMetaTags never populates —
    // canonical is a <link>, so the fallback silently never ran.
    const canonical = page.$('link[rel="canonical"]').attr('href');
    if (canonical) keys.push(coverageKey(canonical, page.url));
    return keys.filter((k): k is string => k !== null);
  }

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const expected = 'Every scanned page appears in the sitemap or llms.txt';

    if (ctx.pages.length === 0) {
      return this.notApplicable('No pages scanned; there is no coverage to check.', expected, 'No pages scanned');
    }

    const indexKeys = await this.indexKeys(ctx);

    // The missing sitemap is sitemap-exists' (1.7) finding. Charging for it here
    // too levied two penalties for one missing file.
    if (indexKeys.size === 0) {
      return this.warn(
        'No sitemap URLs or llms.txt links to compare the scanned pages against.',
        expected,
        'No discovery index entries found',
        {
          priority: 'medium',
          description:
            'Without a sitemap or an llms.txt link list, AI crawlers have no reference list of your pages and must rely entirely on the link graph. Publish at least one.',
          code: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://yoursite.com/</loc>\n    <lastmod>2026-01-01</lastmod>\n  </url>\n</urlset>`,
        },
      );
    }

    const uncovered = ctx.pages
      .filter((page) => !this.pageKeys(page).some((key) => indexKeys.has(key)))
      .map((page) => page.url);

    if (uncovered.length > 0) {
      const shown = `Not indexed: ${uncovered.slice(0, 5).join(', ')}${uncovered.length > 5 ? ` (+${uncovered.length - 5} more)` : ''}`;
      const message = `${uncovered.length}/${ctx.pages.length} scanned page(s) are in no discovery index.`;

      if (uncovered.length / ctx.pages.length > 0.5) {
        return this.fail(message, expected, shown, {
          priority: 'medium',
          description:
            'Most scanned pages are listed in neither the sitemap nor llms.txt. AI crawlers that do not execute JavaScript may never reach them. Add them to your sitemap or llms.txt.',
          code: `<url>\n  <loc>https://yoursite.com/missing-page</loc>\n  <lastmod>2026-01-01</lastmod>\n</url>`,
        });
      }

      return this.warn(message, expected, shown, {
        priority: 'low',
        description:
          'Some scanned pages are listed in neither the sitemap nor llms.txt. Adding them helps AI crawlers discover all your content.',
        code: `<url>\n  <loc>https://yoursite.com/missing-page</loc>\n  <lastmod>2026-01-01</lastmod>\n</url>`,
      });
    }

    return this.pass(
      `All ${ctx.pages.length} scanned page(s) are covered by a discovery index.`,
      expected,
      `${ctx.pages.length} page(s) covered`,
    );
  }
}
