import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from "../../check-context";
import { weightForGrade } from "../../scorer";
import { discoverFeedHeadUrls, sharedFeeds } from "../../gatherers/feeds";

export class RssFeedAudit extends Audit {
  static override meta: AuditMeta = {
    id: "machine-discovery/rss-feed",
    category: "machine-discovery",
    title: "RSS/Atom feed link present",
    failureTitle: "RSS/Atom feed link present",
    description:
      "RSS/Atom feeds let AI agents track new and updated content without re-crawling your entire site. The <head> autodiscovery link is reported alongside the feed, not scored on its own.",
    scoreDisplayMode: "binary",
    weight: weightForGrade("B", "scored"),
    evidenceGrade: "B",
    tier: "scored",
    dossier: "docs/evidence/audits/machine-discovery/rss-feed.md",
    requires: ["origin-reachable", "unblocked-fetches"],
    defaultPriority: "medium",
    guidance: {
      impact:
        "Without an RSS/Atom feed, AI agents have no efficient way to track new and updated content on your site. They must re-crawl your entire site to find changes, which means your latest posts and pages may take much longer to appear in AI search results.",
      fix: 'Create an RSS or Atom feed and link to it in your HTML <head> with a <link rel="alternate"> tag. Most frameworks and CMS platforms can auto-generate feeds. Place the feed at a well-known path like /rss.xml or /feed.xml.',
      code: '<!-- Add to your HTML <head> -->\n<link rel="alternate" type="application/rss+xml" title="Your Site Feed" href="/rss.xml" />\n\n<!-- Example /rss.xml -->\n<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>Your Site</title>\n    <link>https://yoursite.com</link>\n    <description>Site description</description>\n    <item>\n      <title>Article Title</title>\n      <link>https://yoursite.com/article</link>\n      <description>Article summary...</description>\n    </item>\n  </channel>\n</rss>',
      effort: "moderate",
      tags: ["rss", "content-feed", "discoverability"],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const feeds = await sharedFeeds(ctx);
    const autodiscoveryUrls = discoverFeedHeadUrls(ctx);
    const linkNote =
      autodiscoveryUrls.length > 0
        ? `autodiscovery <link> present (${autodiscoveryUrls[0]})`
        : "no autodiscovery <link> in <head>";

    const feed = feeds[0];
    if (!feed) {
      return this.fail(
        "No RSS or Atom feed found via head links or common paths (/rss.xml, /feed.xml, /atom.xml).",
        "At least one feed returns HTTP 200 with valid XML",
        `No feed found; ${linkNote}`,
        {
          priority: "medium",
          description:
            "RSS/Atom feeds let AI agents track new and updated content without re-crawling your entire site. Agents like Perplexity and ChatGPT Browse use feeds to stay current with your latest posts and pages.",
          code: `<!-- Add to your HTML <head> -->\n<link rel="alternate" type="application/rss+xml" title="Your Site Feed" href="/rss.xml" />\n\n<!-- Example /rss.xml -->\n<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>Your Site</title>\n    <link>https://yoursite.com</link>\n    <description>Site description</description>\n    <item>\n      <title>Article Title</title>\n      <link>https://yoursite.com/article</link>\n      <description>Article summary...</description>\n    </item>\n  </channel>\n</rss>`,
        },
      );
    }

    return this.pass(
      `RSS/Atom feed found at ${feed.url}.`,
      "Feed returns HTTP 200",
      `HTTP 200 at ${feed.url}; ${linkNote}`,
    );
  }
}
