import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';

export class NumberedStepsAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'answer-readiness/numbered-steps',
    category: 'answer-readiness',
    title: 'Numbered steps for processes',
    failureTitle: 'Numbered steps for processes',
    description:
      'AI engines extract <ol> lists for "how to" answer snippets. Use ordered lists for step-by-step content to improve your visibility in procedural AI-generated answers.',
    scoreDisplayMode: 'binary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier: 'docs/evidence/audits/answer-readiness/numbered-steps.md',
    applicablePageTypes: ['content'],
    defaultPriority: 'low',
    guidance: {
      impact:
        'AI answer engines extract <ol> ordered lists for "how to" answer snippets, preserving step order in generated responses. Processes described in paragraph form are harder for agents to parse and less likely to appear as structured step-by-step answers.',
      fix: 'Convert any step-by-step or procedural content from paragraphs to <ol> ordered lists. Each <li> should describe one clear step.',
      code: '<h2>How to Get Started</h2>\n<ol>\n  <li>Create an account at yoursite.com/signup</li>\n  <li>Configure your API key in the dashboard</li>\n  <li>Make your first API call using the quickstart guide</li>\n</ol>',
      effort: 'easy',
      tags: ['content-structure', 'html', 'answer-engine'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    if (!page) {
      return this.fail(
        'No pages scanned.',
        '<ol> ordered lists present for process/step content',
        'No pages scanned',
        {
          priority: 'low',
          description: NumberedStepsAudit.meta.description,
          code: '<ol>\n  <li>Step one</li>\n  <li>Step two</li>\n</ol>',
        },
      );
    }

    let olCount = 0;
    let pageWithOl: string | undefined;

    for (const p of ctx.pages) {
      const ols = p.$('ol').length;
      if (ols > 0) {
        olCount += ols;
        if (!pageWithOl) {
          pageWithOl = p.url;
        }
      }
    }

    if (olCount > 0) {
      return this.pass(
        `Found ${olCount} ordered list(s) across scanned pages.`,
        '<ol> ordered lists present for process/step content',
        `${olCount} <ol> element(s)`,
        pageWithOl,
      );
    }

    return this.fail(
      'No ordered lists found on any scanned page.',
      '<ol> ordered lists present for process/step content',
      'Not found',
      {
        priority: 'low',
        description:
          'AI answer engines extract <ol> ordered lists for "how to" answer snippets, preserving step order in generated responses. Processes described in paragraph form are harder for agents to parse and are less likely to appear as structured step-by-step answers.',
        code: '<ol>\n  <li>Step one</li>\n  <li>Step two</li>\n  <li>Step three</li>\n</ol>',
      },
      page.url,
    );
  }
}
