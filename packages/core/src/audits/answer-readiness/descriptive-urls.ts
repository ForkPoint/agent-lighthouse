import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';
import { scanReadTheSite, unreadSiteReason } from '../../scan-evidence';

const BAD_SLUG_PATTERNS = [
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, // UUID
  /\/post-\d+\/?$/i, // /post-123/
  /\/page-\d+\/?$/i, // /page-123/
  /\/p\/\d+\/?$/i, // /p/123/
  /\/\d{5,}\/?$/i, // just a long numeric ID
  /[?&](?:id|p|page_id)=\d+/i, // ?id=123 or ?p=123
  /%[0-9A-Fa-f]{2}.*%[0-9A-Fa-f]{2}/, // heavily encoded URLs
  /\/[a-z]*\/\d+\/?$/i, // /post/12345 or /article/789 — short word + numeric ID
];

export class DescriptiveUrlsAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'answer-readiness/descriptive-urls',
    category: 'answer-readiness',
    title: 'Descriptive URL slugs',
    failureTitle: 'Descriptive URL slugs',
    description:
      'AI engines use URL text as a content signal. Descriptive slugs help agents understand page topics before fetching the content.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/answer-readiness/descriptive-urls.md',
    // Gate exemption: a URL is readable whether or not the page behind it rendered text.
    requires: ['origin-reachable', 'unblocked-fetches'],
    defaultPriority: 'high',
    guidance: {
      impact:
        "AI engines use URL text as a pre-fetch topic signal and display URLs in generated citations. Non-descriptive slugs with UUIDs or numeric IDs provide no topical context, reducing your content's relevance score before the page is even crawled.",
      fix: 'Replace non-descriptive URL slugs (UUIDs, numeric IDs, encoded params) with keyword-rich, human-readable paths that describe the page content.',
      code: '<!-- Change:\n  /post-123/        -> /how-to-optimize-for-ai/\n  /p/456/           -> /pricing-comparison/\n  /?id=789          -> /getting-started-guide/\n  /article/abc-def  -> /ai-search-best-practices/ -->',
      effort: 'moderate',
      tags: ['url-structure', 'seo', 'generative-engine'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    // Nothing here can be attributed to this site; see `scanReadTheSite`.
    if (!scanReadTheSite(ctx.evidence)) {
      return this.notApplicable(
        'No page here can be attributed to this site, so its URLs were not judged.',
        'Page URLs use readable slugs (no UUIDs, no /post-123/, no encoded params)',
        unreadSiteReason(ctx.evidence),
      );
    }

    const page = ctx.pages[0];
    if (!page) {
      return this.fail(
        'No pages scanned.',
        'Page URLs use readable slugs (no UUIDs, no /post-123/, no encoded params)',
        'No pages scanned',
        {
          priority: 'high',
          description:
            'AI engines use URL text as a content signal. Descriptive slugs help agents understand page topics before fetching the content.',
          code: '<!-- Use: /how-to-optimize-for-ai/ instead of /post-123/ -->',
        },
      );
    }

    const badUrls: string[] = [];

    for (const p of ctx.pages) {
      for (const pattern of BAD_SLUG_PATTERNS) {
        if (pattern.test(p.url)) {
          badUrls.push(p.url);
          break;
        }
      }
    }

    if (badUrls.length === 0) {
      return this.pass(
        `All ${ctx.pages.length} scanned page URL(s) use descriptive slugs.`,
        'Page URLs use readable slugs (no UUIDs, no /post-123/, no encoded params)',
        ctx.pages
          .slice(0, 3)
          .map((p) => p.url)
          .join(', '),
        page.url,
      );
    }

    if (badUrls.length < ctx.pages.length) {
      return this.warn(
        `${badUrls.length} of ${ctx.pages.length} page(s) have non-descriptive URL slugs.`,
        'Page URLs use readable slugs (no UUIDs, no /post-123/, no encoded params)',
        badUrls.slice(0, 3).join(', '),
        {
          priority: 'medium',
          description:
            "AI engines use URL text as a pre-fetch topic signal and display URLs in generated citations. Non-descriptive slugs with UUIDs or numeric IDs provide no topical context, reducing your content's relevance score before the page is even crawled. Replace with keyword-rich slugs.",
          code: '<!-- Change /post-123/ to /how-to-optimize-for-ai-agents/ -->',
        },
        badUrls[0],
      );
    }

    return this.fail(
      'All scanned page URLs have non-descriptive slugs.',
      'Page URLs use readable slugs (no UUIDs, no /post-123/, no encoded params)',
      badUrls.slice(0, 3).join(', '),
      {
        priority: 'high',
        description:
          'AI engines use URL text as a pre-fetch topic signal and display URLs in generated citations. All your scanned pages have non-descriptive slugs (UUIDs, numeric IDs), providing zero topical context. Restructure to keyword-rich slugs that describe the page content.',
        code: '<!-- Change:\n  /post-123/ -> /how-to-optimize-for-ai/\n  /p/456/    -> /pricing-comparison/\n  /?id=789   -> /getting-started-guide/ -->',
      },
      badUrls[0],
    );
  }
}
