import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import { scanReadTheSite, unreadSiteReason } from '../../scan-evidence';

export class NoRedirectChainsAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'access-crawl-control/no-redirect-chains',
    category: 'access-crawl-control',
    title: 'No redirect chains',
    failureTitle: 'No redirect chains',
    description:
      'Redirect chains waste AI crawler budget and slow down content discovery. Each page should resolve in a single redirect at most.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/access-crawl-control/no-redirect-chains.md',
    // Gate exemption: a hop that left the site is this audit's subject, and leaving the
    // site is exactly what denies `origin-reachable`. It reads request URL against final
    // URL, which every response carries, and reports "no pages scanned" itself.
    requires: [],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Redirect chains slow down AI crawlers and waste their limited crawl budget. Each extra redirect adds latency and increases the chance a crawler gives up before reaching the final page, leaving content unindexed.',
      fix: 'Update all internal links and sitemap entries to point directly to the final destination URL. Eliminate intermediate redirects by configuring your server to redirect directly from the old URL to the final URL in a single hop.',
      code: '<!-- Update links to use final URLs directly -->\n<a href="https://yoursite.com/final-page">Page</a>\n\n<!-- In sitemap.xml, use the final URL -->\n<url>\n  <loc>https://yoursite.com/final-page</loc>\n</url>',
      effort: 'easy',
      tags: ['redirects', 'performance', 'discoverability'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    // A hop is measurable whatever it landed on, and a hop that left the site
    // is this audit's subject rather than its blind spot: the parked-domain
    // scan is exactly the redirect a reader needs named. So the redirect is
    // counted before the site is attributed, and the guard below only stops
    // the audit *clearing* a site whose pages it never saw.
    const redirected: Array<{ from: string; to: string }> = [];

    for (const page of ctx.pages) {
      const requestUrl = page.fetchResult.url;
      const finalUrl = page.fetchResult.finalUrl;
      if (requestUrl !== finalUrl) {
        redirected.push({ from: requestUrl, to: finalUrl });
      }
    }

    if (redirected.length === 0) {
      // Nothing redirected — but "nothing redirected" is only a clean bill of
      // health for pages that are this site's. See `scanReadTheSite`.
      if (!scanReadTheSite(ctx.evidence)) {
        return this.notApplicable(
          'No page here can be attributed to this site, so its redirect behaviour was not judged.',
          'No redirect chains',
          unreadSiteReason(ctx.evidence),
        );
      }

      if (ctx.pages.length === 0) {
        return this.fail(
          'No pages scanned.',
          'No redirect chains (URL equals finalUrl or single redirect)',
          'No pages scanned',
          {
            priority: 'medium',
            description: NoRedirectChainsAudit.meta.description,
          },
        );
      }

      return this.pass(
        `All ${ctx.pages.length} page(s) resolve without redirects.`,
        'No redirect chains',
        `${ctx.pages.length} page(s) with no redirects`,
      );
    }

    if (redirected.length > ctx.pages.length / 2) {
      return this.fail(
        `${redirected.length}/${ctx.pages.length} page(s) involve redirects.`,
        'No redirect chains',
        `Redirected: ${redirected
          .slice(0, 5)
          .map((r) => `${r.from} -> ${r.to}`)
          .join(', ')}${redirected.length > 5 ? ` (+${redirected.length - 5} more)` : ''}`,
        {
          priority: 'medium',
          description:
            'Many pages involve redirects, which slow down AI crawler discovery and waste crawl budget. Update internal links and sitemap entries to point directly to the final URLs.',
          code: `<!-- Update links to use final URLs directly -->\n<a href="https://yoursite.com/final-page">Page</a>\n\n<!-- Update sitemap -->\n<url>\n  <loc>https://yoursite.com/final-page</loc>\n</url>`,
        },
        redirected[0]?.from,
      );
    }

    return this.warn(
      `${redirected.length}/${ctx.pages.length} page(s) involve redirects.`,
      'No redirect chains',
      `Redirected: ${redirected
        .slice(0, 5)
        .map((r) => `${r.from} -> ${r.to}`)
        .join(', ')}${redirected.length > 5 ? ` (+${redirected.length - 5} more)` : ''}`,
      {
        priority: 'low',
        description:
          'Some pages involve redirects. Update internal links and sitemap entries to point to the final URLs to avoid unnecessary redirects for AI crawlers.',
        code: `<!-- Point directly to the final URL -->\n<a href="https://yoursite.com/final-page">Page</a>`,
      },
      redirected[0]?.from,
    );
  }
}
