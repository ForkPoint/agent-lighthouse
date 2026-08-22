import * as cheerio from 'cheerio';
import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
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

export class RssFeedContentAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'machine-discovery/rss-feed-content',
    category: 'machine-discovery',
    title: 'RSS feed content complete',
    failureTitle: 'RSS feed content complete',
    description:
      'Full-content feeds allow AI agents to index your articles without visiting each page, reducing crawl load and improving content quality in AI responses.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/machine-discovery/rss-feed-content.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Truncated RSS feed items force AI agents to visit each page individually, increasing crawl time and often resulting in incomplete indexing. Full-content feeds let agents ingest all your articles in a single request, producing richer AI-generated answers.',
      fix: 'Include full article content in each feed item using <content:encoded> (RSS) or <content> (Atom). Aim for more than 500 characters per item. Most CMS platforms have a setting to switch from excerpt to full-content feeds.',
      code: '<item>\n  <title>Article Title</title>\n  <link>https://yoursite.com/article</link>\n  <content:encoded><![CDATA[\n    <p>Full article content goes here. Include all paragraphs,\n    headings, and relevant details.</p>\n  ]]></content:encoded>\n</item>',
      effort: 'easy',
      tags: ['rss', 'content-feed', 'discoverability'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const feed = await findFeedResult(ctx);

    if (!feed) {
      return this.fail(
        'No RSS feed found; cannot check content.',
        '<content:encoded> or <description> > 500 chars per item',
        'No feed found',
        {
          priority: 'medium',
          description:
            'First, create an RSS/Atom feed (see check 1.11). Full-content feeds allow AI agents to index your articles without visiting each page, reducing crawl load and improving content quality in AI responses.',
          code: `<item>\n  <title>Article Title</title>\n  <link>https://yoursite.com/article</link>\n  <content:encoded><![CDATA[\n    <p>Full article content goes here...</p>\n  ]]></content:encoded>\n</item>`,
        },
      );
    }

    const $ = cheerio.load(feed.result.body, { xmlMode: true });
    const items = $('item, entry');
    const total = items.length;

    if (total === 0) {
      return this.warn(
        'Feed has no items to check.',
        'Items with full content',
        'No items in feed',
        {
          priority: 'medium',
          description:
            'Your feed exists but contains no items. Add your latest content entries so AI agents can discover and index them.',
          code: `<item>\n  <title>Article Title</title>\n  <link>https://yoursite.com/article</link>\n  <description>Article summary</description>\n</item>`,
        },
      );
    }

    let withFullContent = 0;
    items.each((_, el) => {
      const contentEncoded = $(el).find('content\\:encoded, encoded').text();
      const description = $(el).find('description').text();
      const content = $(el).find('content').text();
      const longestContent = Math.max(contentEncoded.length, description.length, content.length);
      if (longestContent > 500) withFullContent++;
    });

    /* v8 ignore next -- total === 0 is handled by early return above; branch is unreachable */
    const ratio = total > 0 ? withFullContent / total : 0;

    if (ratio < 0.5) {
      return this.fail(
        `Only ${withFullContent}/${total} items have content > 500 characters.`,
        '<content:encoded> or <description> > 500 chars per item',
        `${withFullContent}/${total} items have substantial content`,
        {
          priority: 'medium',
          description:
            'Truncated feed items force AI agents to visit each page individually. Including full content via <content:encoded> lets agents index your articles from the feed alone, improving speed and coverage.',
          code: `<item>\n  <title>Article Title</title>\n  <link>https://yoursite.com/article</link>\n  <content:encoded><![CDATA[\n    <p>Full article content goes here. Include all paragraphs,\n    headings, and relevant details.</p>\n  ]]></content:encoded>\n</item>`,
        },
      );
    }

    if (ratio < 1.0) {
      return this.warn(
        `${withFullContent}/${total} items have full content (> 500 chars).`,
        'All items with > 500 chars',
        `${withFullContent}/${total}`,
        {
          priority: 'low',
          description:
            'Some feed items have truncated content. Expanding all items to full content helps AI agents provide complete answers without additional page fetches.',
          code: `<content:encoded><![CDATA[\n  <p>Full article content here...</p>\n]]></content:encoded>`,
        },
      );
    }

    return this.pass(
      `All ${total} items have full content (> 500 chars).`,
      'All items > 500 chars',
      `${total}/${total} items`,
    );
  }
}
