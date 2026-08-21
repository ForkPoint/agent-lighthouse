// TODO(merge): folds into machine-discovery/rss-feed in Plan 4 (approved 2026-08-21).

import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';

export class RssFeedLinkAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'machine-discovery/rss-feed-link',
    category: 'machine-discovery',
    title: 'RSS feed link in head',
    failureTitle: 'RSS feed link in head',
    description:
      'AI agents use RSS feeds to efficiently monitor your site for new content without re-crawling every page. Without an RSS link, agents must perform expensive full-site crawls to detect updates, meaning your new content takes longer to appear in AI-generated answers.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/machine-discovery/rss-feed-link.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI agents use RSS feeds to efficiently monitor your site for new content without re-crawling every page. Without an RSS link, your new content takes longer to appear in AI-generated answers because agents must perform expensive full-site crawls.',
      fix: 'Create an RSS feed for your content and add a <link rel="alternate"> tag in <head> with type="application/rss+xml".',
      code: '<link rel="alternate" type="application/rss+xml" href="/feed.xml" title="RSS Feed">',
      effort: 'easy',
      tags: ['meta-tags', 'rss', 'content-discovery'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    const link = page?.headLinks?.find(
      (l) => l.rel === 'alternate' && l.type === 'application/rss+xml',
    );

    if (link) {
      return this.pass(
        `RSS feed link found: "${link.href}".`,
        '<link rel="alternate" type="application/rss+xml">',
        `href="${link.href}"`,
        page.url,
      );
    }

    return this.fail(
      'No RSS feed link found in <head>.',
      '<link rel="alternate" type="application/rss+xml">',
      'Not found',
      {
        priority: 'medium',
        description:
          'AI agents use RSS feeds to efficiently monitor your site for new content without re-crawling every page. Without an RSS link, agents must perform expensive full-site crawls to detect updates, meaning your new content takes longer to appear in AI-generated answers.',
        code: '<link rel="alternate" type="application/rss+xml" href="/feed.xml" title="RSS Feed">',
      },
      page?.url,
    );
  }
}
