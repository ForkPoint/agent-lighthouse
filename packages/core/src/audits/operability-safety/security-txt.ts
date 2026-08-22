// TODO(consolidate): security-header-hygiene (Plan 4).

import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';

export class SecurityTxtAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'operability-safety/security-txt',
    category: 'operability-safety',
    title: 'security.txt exists',
    failureTitle: 'security.txt exists',
    description:
      'AI trust-scoring systems check for security.txt as a signal of responsible disclosure practices. Its presence contributes to a higher overall trust score for your site in enterprise AI frameworks that evaluate site maturity before recommending it in answers.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/operability-safety/security-txt.md',
    defaultPriority: 'low',
    guidance: {
      impact:
        'AI trust-scoring systems check for /.well-known/security.txt as a signal that your organization follows responsible disclosure practices. Its presence contributes to a higher overall trust score in enterprise AI frameworks that evaluate site maturity, making your content more likely to be recommended in AI-generated answers.',
      fix: 'Create a security.txt file at /.well-known/security.txt with at minimum a Contact field (email or URL), an Expires date, and preferred languages. Optionally include your security policy URL and PGP key.',
      code: 'Contact: mailto:security@yoursite.com\nExpires: 2027-12-31T23:59:59.000Z\nPreferred-Languages: en\nPolicy: https://yoursite.com/security-policy',
      effort: 'trivial',
      docsUrl: 'https://securitytxt.org/',
      tags: ['security', 'trust', 'compliance'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages?.[0];
    const file = ctx.rootFiles['/.well-known/security.txt'];

    if (file && file.status === 200) {
      return this.pass(
        'security.txt is present at /.well-known/security.txt.',
        '/.well-known/security.txt returns 200',
        `Status ${file.status}`,
        page?.url,
      );
    }

    return this.fail(
      'security.txt is missing. This file helps security researchers report vulnerabilities responsibly.',
      '/.well-known/security.txt returns 200',
      file ? `Status ${file.status}` : 'File not fetched',
      {
        priority: 'low',
        description:
          'AI trust-scoring systems check for security.txt as a signal of responsible disclosure practices. Its presence contributes to a higher overall trust score for your site in enterprise AI frameworks that evaluate site maturity before recommending it in answers.',
        code: 'Contact: mailto:security@example.com\nExpires: 2026-12-31T23:59:59.000Z\nPreferred-Languages: en',
        docsUrl: 'https://securitytxt.org/',
      },
      page?.url,
    );
  }
}
