// TODO(consolidate): security-header-hygiene (Plan 4).

import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';

export class CspHeaderAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'operability-safety/csp-header',
    category: 'operability-safety',
    title: 'Content-Security-Policy header',
    failureTitle: 'Content-Security-Policy header',
    description:
      "AI trust-scoring systems check for CSP headers as a signal of site security maturity. Sites without CSP are flagged as potentially compromised, which can reduce your content's trust score in AI-generated recommendations. CSP also prevents injected scripts from altering the content AI agents crawl.",
    scoreDisplayMode: 'informative',
    weight: weightForGrade('D', 'informative'),
    evidenceGrade: 'D',
    tier: 'informative',
    dossier: 'docs/evidence/audits/operability-safety/csp-header.md',
    defaultPriority: 'high',
    guidance: {
      impact:
        'AI trust-scoring systems treat a missing Content-Security-Policy as a sign of weak security posture. Sites without CSP are vulnerable to XSS attacks that can inject malicious content into the pages AI agents crawl, poisoning AI knowledge bases with attacker-controlled text. This lowers your trust score and may cause AI systems to deprioritize or exclude your content from recommendations.',
      fix: 'Add a Content-Security-Policy header to your server responses. Start with a restrictive policy that only allows resources from your own origin, then gradually expand as needed.',
      code: "Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'",
      effort: 'moderate',
      docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP',
      tags: ['security', 'headers'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages?.[0];
    const headers = page?.fetchResult.headers ?? {};
    const csp = headers['content-security-policy'];

    if (csp) {
      return this.pass(
        'Content-Security-Policy header is present.',
        'Content-Security-Policy header present on homepage response',
        `content-security-policy: ${csp.length > 120 ? csp.slice(0, 120) + '...' : csp}`,
        page?.url,
      );
    }

    return this.fail(
      'Content-Security-Policy header is missing. This header helps prevent XSS and injection attacks.',
      'Content-Security-Policy header present on homepage response',
      'Header not found',
      {
        priority: 'high',
        description:
          "AI trust-scoring systems check for CSP headers as a signal of site security maturity. Sites without CSP are flagged as potentially compromised, which can reduce your content's trust score in AI-generated recommendations. CSP also prevents injected scripts from altering the content AI agents crawl.",
        code: "Content-Security-Policy: default-src 'self'; script-src 'self'",
      },
      page?.url,
    );
  }
}
