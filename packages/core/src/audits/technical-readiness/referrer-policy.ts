import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

export class ReferrerPolicyAudit extends Audit {
  static override meta: AuditMeta = {
    id: '8.5',
    category: 'technical-readiness',
    title: 'Referrer-Policy header',
    failureTitle: 'Referrer-Policy header',
    description:
      'AI trust-scoring systems check for Referrer-Policy as a privacy maturity signal. Without it, your site leaks full URL paths in referrer headers to third parties, which AI security audits flag as a privacy concern that can reduce trust scores.',
    scoreDisplayMode: 'informative',
    weight: 0,
    defaultPriority: 'medium',
    deprecated: {
      notice: 'Referrer-Policy governs outbound referrers from the site\'s own pages; it cannot affect how any crawler or agent reads the site.',
      link: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/NOT-A-FACTOR.md#technical-readinessreferrer-policy',
    },
    guidance: {
      impact:
        "Without a Referrer-Policy header, your site leaks full URL paths (including query parameters) in HTTP Referer headers when users navigate to external links. AI security audits flag this as a privacy vulnerability, and trust-scoring systems lower your site's rating. Sensitive URL parameters like session tokens or search queries may be exposed to third parties.",
      fix: 'Add a Referrer-Policy header to your server responses. The recommended value is "strict-origin-when-cross-origin", which sends the full URL for same-origin requests but only the origin for cross-origin requests.',
      code: 'Referrer-Policy: strict-origin-when-cross-origin',
      effort: 'trivial',
      docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy',
      tags: ['security', 'headers', 'privacy'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages?.[0];
    const headers = page?.fetchResult.headers ?? {};
    const value = headers['referrer-policy'];

    if (value) {
      return this.pass(
        `Referrer-Policy header is present: ${value}`,
        'Referrer-Policy header present on homepage response',
        `referrer-policy: ${value}`,
        page?.url,
      );
    }

    return this.fail(
      'Referrer-Policy header is missing from the homepage response.',
      'Referrer-Policy header present on homepage response',
      'Header not found',
      {
        priority: 'medium',
        description:
          'AI trust-scoring systems check for Referrer-Policy as a privacy maturity signal. Without it, your site leaks full URL paths in referrer headers to third parties, which AI security audits flag as a privacy concern that can reduce trust scores.',
        code: 'Referrer-Policy: strict-origin-when-cross-origin',
      },
      page?.url,
    );
  }
}
