import * as cheerio from "cheerio";
import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import type { CheckContext } from "#core/check-context";
import { weightForGrade } from "#core/scorer";
import { sharedFeeds } from "#core/gatherers/feeds";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  NoticeKind,
  ScoreDisplayMode,
} from "#core/types";

export class RssFeedContentAudit extends Audit {
  static override meta: AuditMeta = {
    id: "machine-discovery/rss-feed-content",
    category: "machine-discovery",
    title: "RSS feed content complete",
    failureTitle: "RSS feed content complete",
    description:
      "Reports how many feed items carry full article text (more than 500 characters). Search and AI crawlers take URLs from feeds and fetch the page itself, and excerpt feeds are valid, so this check is reported and never scored.",
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: weightForGrade(EvidenceGrade.C, AuditTier.Informative),
    evidenceGrade: EvidenceGrade.C,
    tier: AuditTier.Informative,
    dossier: "docs/evidence/audits/machine-discovery/rss-feed-content.md",
    deprecated: {
      kind: NoticeKind.Unconsumed,
      notice:
        "No search engine or AI vendor documents reading full article text from a feed. Documented consumers take URLs from feeds and fetch the article page itself.",
      link: "https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap",
      replacement:
        "Keep the feed for URL discovery (machine-discovery/rss-feed). Excerpt feeds are valid.",
    },
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    defaultPriority: CheckPriority.Low,
    guidance: {
      impact:
        "Google reads feeds as a list of recent URLs, and the Common Crawl news crawler takes links from feeds and fetches the pages. No consumer documents reading the article body from the feed, so an excerpt feed loses nothing with an AI agent.",
      fix: "Optional. Full content in <content:encoded> (RSS) or <content> (Atom) serves human feed readers. For AI agents, keep the feed current and its links pointing at the article pages.",
      code: "<item>\n  <title>Article Title</title>\n  <link>https://yoursite.com/article</link>\n  <content:encoded><![CDATA[\n    <p>Full article content goes here. Include all paragraphs,\n    headings, and relevant details.</p>\n  ]]></content:encoded>\n</item>",
      effort: FixEffort.Easy,
      tags: ["rss", "content-feed", "discoverability"],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const feeds = await sharedFeeds(ctx);
    const feed = feeds[0];

    // No feed, no feed content to grade. Whether a site should publish a feed
    // is a separate question; an absent feed is not a truncated one.
    if (!feed) {
      return this.notApplicable(
        "No RSS or Atom feed found, so there is no feed content to check.",
        "<content:encoded> or <description> > 500 chars per item",
        "No feed found",
      );
    }

    const $ = cheerio.load(feed.body ?? "", { xmlMode: true });
    const items = $("item, entry");
    const total = items.length;

    if (total === 0) {
      return this.notApplicable(
        "The feed has no items, so there is no item content to check.",
        "Items with full content",
        "No items in feed",
      );
    }

    let withFullContent = 0;
    items.each((_, el) => {
      const contentEncoded = $(el).find("content\\:encoded, encoded").text();
      const description = $(el).find("description").text();
      const content = $(el).find("content").text();
      const longestContent = Math.max(
        contentEncoded.length,
        description.length,
        content.length,
      );
      if (longestContent > 500) withFullContent++;
    });

    /* v8 ignore next -- total === 0 is handled by early return above; branch is unreachable */
    const ratio = total > 0 ? withFullContent / total : 0;

    // Reported, never warned or failed: an excerpt feed is valid RSS and Atom,
    // and the documented consumers fetch the page (policy.md, "Informative or
    // obsolete").
    if (ratio < 1.0) {
      return this.pass(
        `${withFullContent}/${total} items carry full content (> 500 chars). Search and AI crawlers take the URL from the feed and fetch the article page, so excerpts cost nothing with an AI agent.`,
        "All items > 500 chars",
        `${withFullContent}/${total} items have substantial content`,
      );
    }

    return this.pass(
      `All ${total} items have full content (> 500 chars).`,
      "All items > 500 chars",
      `${total}/${total} items`,
    );
  }
}
