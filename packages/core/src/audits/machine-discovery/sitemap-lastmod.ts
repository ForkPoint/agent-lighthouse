import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import { readSitemap, NO_SITEMAP } from '../../gatherers/sitemap';

export class SitemapLastmodAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'machine-discovery/sitemap-lastmod',
    category: 'machine-discovery',
    title: 'Sitemap has lastmod dates',
    failureTitle: 'Sitemap has lastmod dates',
    description:
      'AI crawlers use <lastmod> to decide which pages to re-index and which to skip. Without these dates, crawlers must re-fetch every page on every visit.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/machine-discovery/sitemap-lastmod.md',
    requires: ['origin-reachable'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Without <lastmod> dates, AI crawlers must re-fetch every page on every visit because they cannot tell which pages have changed. This wastes crawl budget and delays indexing of your freshest content.',
      fix: 'Add accurate <lastmod> dates to every <url> entry in your sitemap.xml. Update the date whenever the page content actually changes. Use ISO 8601 format (YYYY-MM-DD or full datetime).',
      code: '<url>\n  <loc>https://yoursite.com/page</loc>\n  <lastmod>2026-01-15</lastmod>\n</url>',
      effort: 'easy',
      docsUrl: 'https://www.sitemaps.org/protocol.html',
      tags: ['sitemap', 'seo', 'discoverability'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const sitemap = await readSitemap(ctx);

    if (sitemap.kind === 'absent' || sitemap.kind === 'empty') {
      return this.notApplicable(
        NO_SITEMAP,
        'At least 80% of <url> entries have <lastmod>',
        'No sitemap entries found',
      );
    }

    if (sitemap.kind === 'malformed') {
      return this.fail(
        'Sitemap file found but does not contain valid <urlset> or <sitemapindex>.',
        'At least 80% of <url> entries have <lastmod>',
        'Malformed sitemap XML',
      );
    }

    const total = sitemap.tree.entries.length;
    if (total === 0) {
      return this.notApplicable(
        NO_SITEMAP,
        'At least 80% with <lastmod>',
        'No <url> entries found',
      );
    }

    let withLastmod = 0;
    for (const entry of sitemap.tree.entries) {
      if (entry.lastmod) withLastmod++;
    }

    const ratio = withLastmod / total;

    if (ratio < 0.8) {
      return this.fail(
        `Only ${Math.round(ratio * 100)}% of URL entries have <lastmod> (${withLastmod}/${total}).`,
        'At least 80% of <url> entries have <lastmod>',
        `${withLastmod}/${total} (${Math.round(ratio * 100)}%)`,
        {
          priority: 'medium',
          description:
            'AI crawlers use <lastmod> to decide which pages to re-index and which to skip. Without these dates, crawlers must re-fetch every page on every visit, wasting bandwidth and slowing indexing.',
          code: `<url>\n  <loc>https://yoursite.com/page</loc>\n  <lastmod>2026-01-15</lastmod>\n</url>`,
        },
      );
    }

    return this.pass(
      `${Math.round(ratio * 100)}% of URL entries have <lastmod>.`,
      '>= 80% with <lastmod>',
      `${withLastmod}/${total} (${Math.round(ratio * 100)}%)`,
    );
  }
}

