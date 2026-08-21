import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';

export class MarkdownAlternateAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'content-extraction/markdown-alternate',
    category: 'content-extraction',
    title: 'Markdown alternate link',
    failureTitle: 'Markdown alternate link',
    description:
      'AI agents prefer Markdown over HTML because it strips away layout noise and fits more content into limited context windows. A Markdown alternate link lets agents fetch a clean, token-efficient version of your page, improving the accuracy of AI-generated summaries.',
    scoreDisplayMode: 'binary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/content-extraction/markdown-alternate.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI agents prefer Markdown over HTML because it strips away layout noise and fits more content into limited context windows. Without a Markdown alternate, agents must parse full HTML, reducing the accuracy of AI-generated summaries.',
      fix: 'Create a Markdown version of your page and add a <link rel="alternate"> tag in <head> with type="text/markdown" pointing to it.',
      code: '<link rel="alternate" type="text/markdown" href="/page.md">',
      effort: 'moderate',
      tags: ['meta-tags', 'markdown', 'ai-discovery'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    const link = page?.headLinks?.find((l) => l.rel === 'alternate' && l.type === 'text/markdown');

    if (link) {
      return this.pass(
        `Markdown alternate link found: "${link.href}".`,
        '<link rel="alternate" type="text/markdown">',
        `href="${link.href}"`,
        page.url,
      );
    }

    return this.fail(
      'No Markdown alternate link found in <head>.',
      '<link rel="alternate" type="text/markdown">',
      'Not found',
      {
        priority: 'medium',
        description:
          'AI agents prefer Markdown over HTML because it strips away layout noise and fits more content into limited context windows. A Markdown alternate link lets agents fetch a clean, token-efficient version of your page, improving the accuracy of AI-generated summaries.',
        code: '<link rel="alternate" type="text/markdown" href="/page.md">',
      },
      page?.url,
    );
  }
}
