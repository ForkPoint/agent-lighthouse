import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import type { FetchResult } from '../../fetcher';

function isOk(result: FetchResult): boolean {
  return result.status === 200;
}

export class NoBrokenLinksAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'machine-discovery/no-broken-links',
    category: 'machine-discovery',
    title: 'No broken internal links',
    failureTitle: 'No broken internal links',
    description:
      'Broken internal links create dead ends for AI crawlers and waste their limited crawl budget.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/machine-discovery/no-broken-links.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    defaultPriority: 'high',
    guidance: {
      impact:
        "Broken internal links waste AI crawlers' limited crawl budget by sending them to dead ends. This means fewer of your pages get indexed, and users asking AI about your site may encounter errors or missing information.",
      fix: 'Audit all internal links and fix or remove any that return non-200 status codes. Update href values to point to the correct URLs, and set up redirects for pages that have moved.',
      code: '<!-- Fix broken links by updating the href -->\n<a href="/correct-path">Page title</a>\n\n<!-- Or set up a redirect for moved pages -->\n<!-- In next.config.js -->\nredirects: [{ source: "/old-path", destination: "/new-path", permanent: true }]',
      effort: 'easy',
      tags: ['broken-links', 'crawl-budget', 'discoverability'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    if (ctx.pages.length === 0) {
      return this.fail(
        'No pages scanned.',
        'All internal links return HTTP 200',
        'No pages scanned',
        {
          priority: 'high',
          description: NoBrokenLinksAudit.meta.description,
        },
      );
    }

    const domain = ctx.domain;
    const internalUrls = new Set<string>();

    for (const page of ctx.pages) {
      const $ = page.$;
      $('a[href]').each((_, el) => {
        /* v8 ignore next -- a[href] selector guarantees attr is always a string */
        const href = $(el).attr('href') ?? '';
        try {
          const resolved = new URL(href, page.url);
          if (resolved.hostname === domain || resolved.hostname.endsWith(`.${domain}`)) {
            // Normalize: remove hash, keep path + query
            resolved.hash = '';
            internalUrls.add(resolved.href);
          }
        } catch {
          // Skip invalid URLs
        }
      });
    }

    if (internalUrls.size === 0) {
      return this.warn(
        'No internal links found to validate.',
        'All internal links return HTTP 200',
        'No internal links found',
        {
          priority: 'medium',
          description:
            'No internal links were found on the scanned pages. Add internal links between related pages to help AI crawlers discover your content.',
          code: `<a href="/related-page">Related content</a>`,
        },
      );
    }

    // Sample up to 20 internal links to avoid excessive fetching
    const urlsToCheck = Array.from(internalUrls).slice(0, 20);
    const results = await Promise.all(urlsToCheck.map((url) => ctx.fetch({ url })));

    const broken = results.filter((r) => !isOk(r));

    if (broken.length > 0) {
      const brokenUrls = broken.map((r) => `${r.url} (${r.status})`).join(', ');

      if (broken.length > urlsToCheck.length / 2) {
        return this.fail(
          `${broken.length}/${urlsToCheck.length} sampled internal link(s) are broken.`,
          'All internal links return HTTP 200',
          `Broken: ${brokenUrls}`,
          {
            priority: 'high',
            description:
              'Many internal links are broken, creating dead ends for AI crawlers. Fix or remove these links to ensure crawlers can navigate your site effectively.',
            code: `<!-- Fix broken links -->\n<a href="/correct-path">Page title</a>`,
          },
        );
      }

      return this.warn(
        `${broken.length}/${urlsToCheck.length} sampled internal link(s) are broken.`,
        'All internal links return HTTP 200',
        `Broken: ${brokenUrls}`,
        {
          priority: 'medium',
          description:
            'Some internal links are broken. Fix them to prevent AI crawlers from encountering dead ends.',
          code: `<!-- Fix broken links -->\n<a href="/correct-path">Page title</a>`,
        },
      );
    }

    return this.pass(
      `All ${urlsToCheck.length} sampled internal link(s) return HTTP 200.`,
      'All internal links return HTTP 200',
      `${urlsToCheck.length} link(s) checked`,
    );
  }
}
