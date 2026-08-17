import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import type { FetchResult } from '../../fetcher';

function isOk(result: FetchResult): boolean {
  return result.status === 200;
}

/** Find RSS/Atom feed result -- check head links on pages first, then root file paths */
async function findFeedResult(
  ctx: CheckContext,
): Promise<{ result: FetchResult; url: string } | null> {
  // Check <link rel="alternate"> in page heads
  for (const page of ctx.pages) {
    for (const link of page.headLinks) {
      if (
        link.rel === 'alternate' &&
        (link.type === 'application/rss+xml' || link.type === 'application/atom+xml') &&
        link.href
      ) {
        let feedUrl = link.href;
        if (feedUrl.startsWith('/')) feedUrl = `${ctx.baseUrl}${feedUrl}`;
        const result = await ctx.fetch({ url: feedUrl });
        if (isOk(result)) return { result, url: feedUrl };
      }
    }
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
    id: '1.11',
    category: 'content-discoverability',
    title: 'RSS/Atom feed link present',
    failureTitle: 'RSS/Atom feed link present',
    description:
      'RSS/Atom feeds let AI agents track new and updated content without re-crawling your entire site.',
    scoreDisplayMode: 'binary',
    weight: 1.0,
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
    const feed = await findFeedResult(ctx);

    if (!feed) {
      return this.fail(
        'No RSS or Atom feed found via head links or common paths (/rss.xml, /feed.xml, /atom.xml).',
        'At least one feed returns HTTP 200 with valid XML',
        'No feed found',
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
      `HTTP 200 at ${feed.url}`,
    );
  }
}
