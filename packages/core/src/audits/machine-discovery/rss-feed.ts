import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import type { FetchResult } from '../../fetcher';

function isOk(result: FetchResult): boolean {
  return result.status === 200;
}

/** Feed media types, MIME parameters stripped. Atom and JSON Feed included. */
const FEED_TYPES = new Set([
  'application/rss+xml',
  'application/atom+xml',
  'application/feed+json',
  'application/rdf+xml',
]);

/**
 * Every `<link>` on the scanned pages that advertises a feed, resolved to an
 * absolute URL.
 *
 * Absorbed from v1 4.16 with its review's required fixes: `rel` is a normalized
 * token list rather than an exact string, the media type is compared with its
 * MIME parameters stripped, Atom and JSON Feed count, and every page is
 * inspected — a site declaring its feed on /blog rather than on the homepage
 * used to be reported as having no feed link at all.
 */
function autodiscoveryLinks(ctx: CheckContext): Array<{ url: string; pageUrl: string }> {
  const found: Array<{ url: string; pageUrl: string }> = [];
  for (const page of ctx.pages) {
    for (const link of page.headLinks) {
      const rels = link.rel.toLowerCase().trim().split(/\s+/);
      if (!rels.includes('alternate')) continue;
      const type = link.type.split(';')[0]!.trim().toLowerCase();
      if (!FEED_TYPES.has(type) || !link.href) continue;
      try {
        // v1 resolved '/'-prefixed hrefs only, so `feed.xml` or `./rss` was
        // handed to the fetcher verbatim and always failed.
        found.push({ url: new URL(link.href, page.url).href, pageUrl: page.url });
      } catch {
        // Skip unparseable hrefs.
      }
    }
  }
  return found;
}

/** Find RSS/Atom feed result -- check head links on pages first, then root file paths */
async function findFeedResult(
  ctx: CheckContext,
  links: Array<{ url: string }>,
): Promise<{ result: FetchResult; url: string } | null> {
  for (const link of links) {
    const result = await ctx.fetch({ url: link.url });
    if (isOk(result)) return { result, url: link.url };
  }

  // Fall back to well-known paths
  const paths = ['/rss.xml', '/feed.xml', '/atom.xml'];
  for (const path of paths) {
    const rootResult = ctx.rootFiles[path];
    if (rootResult && isOk(rootResult)) {
      return { result: rootResult, url: `${ctx.baseUrl}${path}` };
    }
  }

  // Try /atom.xml explicitly since it may not be in rootFiles
  const atomResult = await ctx.fetch({ url: `${ctx.baseUrl}/atom.xml` });
  if (isOk(atomResult)) return { result: atomResult, url: `${ctx.baseUrl}/atom.xml` };

  return null;
}

export class RssFeedAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'machine-discovery/rss-feed',
    category: 'machine-discovery',
    title: 'RSS/Atom feed link present',
    failureTitle: 'RSS/Atom feed link present',
    description:
      'RSS/Atom feeds let AI agents track new and updated content without re-crawling your entire site. The <head> autodiscovery link is reported alongside the feed, not scored on its own.',
    scoreDisplayMode: 'binary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier: 'docs/evidence/audits/machine-discovery/rss-feed.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Without an RSS/Atom feed, AI agents have no efficient way to track new and updated content on your site. They must re-crawl your entire site to find changes, which means your latest posts and pages may take much longer to appear in AI search results.',
      fix: 'Create an RSS or Atom feed and link to it in your HTML <head> with a <link rel="alternate"> tag. Most frameworks and CMS platforms can auto-generate feeds. Place the feed at a well-known path like /rss.xml or /feed.xml.',
      code: '<!-- Add to your HTML <head> -->\n<link rel="alternate" type="application/rss+xml" title="Your Site Feed" href="/rss.xml" />\n\n<!-- Example /rss.xml -->\n<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>Your Site</title>\n    <link>https://yoursite.com</link>\n    <description>Site description</description>\n    <item>\n      <title>Article Title</title>\n      <link>https://yoursite.com/article</link>\n      <description>Article summary...</description>\n    </item>\n  </channel>\n</rss>',
      effort: 'moderate',
      tags: ['rss', 'content-feed', 'discoverability'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const links = autodiscoveryLinks(ctx);
    const feed = await findFeedResult(ctx, links);
    // Autodiscovery is a convention with browser and aggregator consumers but no
    // documented AI consumer, so its state is reported next to the feed rather
    // than scored on its own (v1 4.16 failed sites for the link alone).
    const linkNote =
      links.length > 0
        ? `autodiscovery <link> present (${links[0]!.url})`
        : 'no autodiscovery <link> in <head>';

    if (!feed) {
      return this.fail(
        'No RSS or Atom feed found via head links or common paths (/rss.xml, /feed.xml, /atom.xml).',
        'At least one feed returns HTTP 200 with valid XML',
        `No feed found; ${linkNote}`,
        {
          priority: 'medium',
          description:
            'RSS/Atom feeds let AI agents track new and updated content without re-crawling your entire site. Agents like Perplexity and ChatGPT Browse use feeds to stay current with your latest posts and pages.',
          code: `<!-- Add to your HTML <head> -->\n<link rel="alternate" type="application/rss+xml" title="Your Site Feed" href="/rss.xml" />\n\n<!-- Example /rss.xml -->\n<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>Your Site</title>\n    <link>https://yoursite.com</link>\n    <description>Site description</description>\n    <item>\n      <title>Article Title</title>\n      <link>https://yoursite.com/article</link>\n      <description>Article summary...</description>\n    </item>\n  </channel>\n</rss>`,
        },
      );
    }

    return this.pass(
      `RSS/Atom feed found at ${feed.url}.`,
      'Feed returns HTTP 200',
      `HTTP 200 at ${feed.url}; ${linkNote}`,
    );
  }
}
