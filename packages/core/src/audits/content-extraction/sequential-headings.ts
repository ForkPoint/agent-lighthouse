import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { extractHeadings } from '../../parser';
import { weightForGrade } from '../../scorer';

export class SequentialHeadingsAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'content-extraction/sequential-headings',
    category: 'content-extraction',
    title: 'Sequential heading hierarchy',
    failureTitle: 'Sequential heading hierarchy',
    description:
      'AI systems build content outlines from headings to understand document structure. Skipped levels (e.g., h1 to h3 without h2) break the hierarchy, causing agents to misinterpret section nesting and produce inaccurate content summaries. Fix heading levels to follow a sequential order.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier: 'docs/evidence/audits/content-extraction/sequential-headings.md',
    defaultPriority: 'high',
    guidance: {
      impact:
        'AI systems build content outlines from heading levels to understand document hierarchy. Skipped levels (e.g., h1 directly to h3) break this hierarchy, causing agents to misinterpret section nesting and produce inaccurate content summaries with wrong parent-child relationships.',
      fix: 'Ensure headings follow a sequential order without skipping levels. After an h1, use h2 for major sections, h3 for subsections within h2, and so on. Never jump from h1 to h3 or h2 to h4 without the intermediate level.',
      code: '<h1>Page Title</h1>\n  <h2>Major Section</h2>\n    <h3>Subsection</h3>\n    <h3>Another Subsection</h3>\n  <h2>Another Major Section</h2>',
      effort: 'easy',
      docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/Heading_Elements',
      tags: ['headings', 'hierarchy', 'structure', 'semantic'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    let pagesWithSkips = 0;
    const totalPages = ctx.pages.length;
    const skipDetails: string[] = [];

    // Check if any page has at least 2 headings to evaluate
    let hasEnoughHeadings = false;

    for (const page of ctx.pages) {
      const headings = extractHeadings(page.$);
      if (headings.length >= 2) hasEnoughHeadings = true;
      let hasSkip = false;
      for (let i = 1; i < headings.length; i++) {
        const prev = headings[i - 1].level;
        const curr = headings[i].level;
        // A skip occurs when a heading goes deeper by more than 1 level
        if (curr > prev + 1) {
          hasSkip = true;
          skipDetails.push(`${page.url}: h${prev} -> h${curr} (skipped h${prev + 1})`);
          break;
        }
      }
      if (hasSkip) pagesWithSkips++;
    }

    if (!hasEnoughHeadings) {
      return this.warn(
        'Page has fewer than 2 headings — cannot evaluate heading hierarchy.',
        'No heading level skips (e.g. h1 -> h3 without h2)',
        'Insufficient headings to evaluate',
        {
          priority: 'medium',
          description:
            'AI systems build content outlines from headings to understand document structure. Pages need at least two headings to form a hierarchy that can be evaluated for proper sequencing.',
          code: '<h1>Page Title</h1>\n<h2>Section</h2>\n<h3>Subsection</h3>',
        },
      );
    }

    const pass = pagesWithSkips === 0;
    const majorityPass = pagesWithSkips <= Math.floor(totalPages / 2);

    if (pass) {
      return this.pass(
        'All pages have sequential heading hierarchy with no level skips.',
        'No heading level skips (e.g. h1 -> h3 without h2)',
        'No heading skips detected',
      );
    }

    if (majorityPass) {
      return this.warn(
        `${pagesWithSkips}/${totalPages} page(s) have heading level skips.`,
        'No heading level skips (e.g. h1 -> h3 without h2)',
        skipDetails.slice(0, 3).join('; '),
        {
          priority: 'high',
          description:
            'AI systems build content outlines from headings to understand document structure. Skipped levels (e.g., h1 to h3 without h2) break the hierarchy, causing agents to misinterpret section nesting and produce inaccurate content summaries. Fix heading levels to follow a sequential order.',
          code: '<h1>Page Title</h1>\n<h2>Section</h2>\n<h3>Subsection</h3>',
        },
      );
    }

    return this.fail(
      `${pagesWithSkips}/${totalPages} page(s) have heading level skips.`,
      'No heading level skips (e.g. h1 -> h3 without h2)',
      skipDetails.slice(0, 3).join('; '),
      {
        priority: 'high',
        description:
          'AI systems build content outlines from headings to understand document structure. Skipped levels (e.g., h1 to h3 without h2) break the hierarchy, causing agents to misinterpret section nesting and produce inaccurate content summaries. Fix heading levels to follow a sequential order.',
        code: '<h1>Page Title</h1>\n<h2>Section</h2>\n<h3>Subsection</h3>',
      },
    );
  }
}
