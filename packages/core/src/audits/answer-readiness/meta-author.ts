import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';

export class MetaAuthorAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'answer-readiness/meta-author',
    category: 'answer-readiness',
    title: 'Meta author present',
    failureTitle: 'Meta author present',
    description:
      'AI agents use the meta author tag to attribute content to a specific person or organization for E-E-A-T scoring. Without it, your content appears authorless, which reduces trust signals in AI ranking systems that prioritize named expertise.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/answer-readiness/meta-author.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    applicablePageTypes: ['content'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI agents use the meta author tag to attribute content to a specific person or organization for E-E-A-T scoring. Without it, your content appears authorless, reducing trust signals in AI ranking systems.',
      fix: 'Add a <meta name="author"> tag with the real name of the content creator or your organization name.',
      code: '<meta name="author" content="Jane Smith">',
      effort: 'trivial',
      tags: ['meta-tags', 'e-e-a-t', 'trust'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    const author = page?.meta?.['author'] ?? '';

    if (author.trim().length > 0) {
      return this.pass(
        `Meta author is set to "${author}".`,
        'meta[author] with a non-empty person or organisation name',
        author,
        page.url,
      );
    }

    return this.fail(
      'Meta author tag is missing or empty.',
      'meta[author] with a non-empty person or organisation name',
      'Not found',
      {
        priority: 'medium',
        description:
          'AI agents use the meta author tag to attribute content to a specific person or organization for E-E-A-T scoring. Without it, your content appears authorless, which reduces trust signals in AI ranking systems that prioritize named expertise.',
        code: '<meta name="author" content="Your Name or Organisation">',
      },
      page?.url,
    );
  }
}
