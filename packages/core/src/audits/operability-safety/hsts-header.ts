// TODO(consolidate): security-header-hygiene (Plan 4).
// Tier is informative despite the grade-B dossier: the approved map row for 8.2 rules the
// consolidated signal "weight 0, never fails a site", which governs it from now on.

import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';

export class HstsHeaderAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'operability-safety/hsts-header',
    category: 'operability-safety',
    title: 'HSTS header',
    failureTitle: 'HSTS header',
    description:
      'AI agents that follow redirects from HTTP to HTTPS waste time on the redirect hop and may be blocked by strict security policies that reject non-HSTS sites. HSTS ensures agents always connect over HTTPS on the first request, improving crawl efficiency and trust scoring.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('B', 'informative'),
    evidenceGrade: 'B',
    tier: 'informative',
    dossier: 'docs/evidence/audits/operability-safety/hsts-header.md',
    defaultPriority: 'high',
    guidance: {
      impact:
        'Without HSTS, AI agents that first connect over HTTP must follow a redirect to HTTPS, wasting a round-trip on every new connection. Worse, strict enterprise AI security policies may reject non-HSTS sites outright, blocking your content from enterprise RAG pipelines and AI-powered procurement tools.',
      fix: 'Add the Strict-Transport-Security header to your HTTPS responses. Use a max-age of at least one year (31536000 seconds), include subdomains, and add the preload directive to be included in browser preload lists.',
      code: 'Strict-Transport-Security: max-age=31536000; includeSubDomains; preload',
      effort: 'trivial',
      docsUrl:
        'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security',
      tags: ['security', 'headers', 'https'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages?.[0];
    const headers = page?.fetchResult.headers ?? {};
    const hsts = headers['strict-transport-security'];

    if (hsts) {
      return this.pass(
        `Strict-Transport-Security header is present: ${hsts}`,
        'Strict-Transport-Security header present on homepage response',
        `strict-transport-security: ${hsts}`,
        page?.url,
      );
    }

    return this.fail(
      'Strict-Transport-Security header is missing from the homepage response.',
      'Strict-Transport-Security header present on homepage response',
      'Header not found',
      {
        priority: 'high',
        description:
          'AI agents that follow redirects from HTTP to HTTPS waste time on the redirect hop and may be blocked by strict security policies that reject non-HSTS sites. HSTS ensures agents always connect over HTTPS on the first request, improving crawl efficiency and trust scoring.',
        code: 'Strict-Transport-Security: max-age=31536000; includeSubDomains; preload',
      },
      page?.url,
    );
  }
}
