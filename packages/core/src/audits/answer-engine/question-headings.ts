import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { extractHeadings } from '../../parser';

export class QuestionHeadingsAudit extends Audit {
  static override meta: AuditMeta = {
    id: '9.2',
    category: 'answer-engine',
    title: 'Question-formatted headings',
    failureTitle: 'Question-formatted headings',
    description:
      'AI answer engines directly match user questions to heading text. Question-formatted headings (ending with "?") are the primary signal AI systems use to identify which section answers a specific query.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        "AI answer engines directly match user questions to heading text. Question-formatted headings are the primary signal for identifying which section answers a specific query. Without them, agents must guess which section is relevant, reducing your content's match rate.",
      fix: 'Reformat H2/H3 headings as questions that end with "?" to match the natural language patterns users ask AI agents. Follow each question heading immediately with a direct answer paragraph.',
      code: '<h2>What is unified content preparation?</h2>\n<p>Unified content preparation is the process of structuring your site content for consumption by both humans and AI agents.</p>',
      effort: 'easy',
      tags: ['content-structure', 'copywriting', 'answer-engine'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    if (!page) {
      return this.fail('No pages scanned.', 'H2/H3 headings ending with "?"', 'No pages scanned', {
        priority: 'medium',
        description: QuestionHeadingsAudit.meta.description,
        code: '<h2>What is unified content preparation?</h2>\n<p>Unified content preparation is...</p>',
      });
    }

    let questionCount = 0;
    let totalH2H3 = 0;
    const examples: string[] = [];

    for (const p of ctx.pages) {
      const headings = extractHeadings(p.$);
      for (const h of headings) {
        if (h.level === 2 || h.level === 3) {
          totalH2H3++;
          if (h.text.trimEnd().endsWith('?')) {
            questionCount++;
            if (examples.length < 3) {
              examples.push(h.text);
            }
          }
        }
      }
    }

    if (questionCount >= 2) {
      return this.pass(
        `Found ${questionCount} question-formatted H2/H3 heading(s).`,
        'H2/H3 headings ending with "?"',
        examples.join('; '),
        page.url,
      );
    }

    if (questionCount === 1) {
      return this.warn(
        `Only 1 question-formatted heading found out of ${totalH2H3} H2/H3 headings.`,
        'H2/H3 headings ending with "?"',
        examples.join('; '),
        {
          priority: 'medium',
          description:
            'Adding more question-formatted H2/H3 headings increases the number of user queries your content can match, boosting your visibility in AI-generated answers and "People Also Ask" results.',
          code: '<h2>How does your product compare to alternatives?</h2>\n<h2>What are the system requirements?</h2>',
        },
        page.url,
      );
    }

    return this.fail(
      `No question-formatted H2/H3 headings found across ${ctx.pages.length} page(s).`,
      'H2/H3 headings ending with "?"',
      'Not found',
      {
        priority: 'medium',
        description:
          'Question-formatted headings ("What is X?", "How does Y work?") are the primary signal for identifying which section answers a query. Each question heading should be followed immediately by a direct answer paragraph.',
        code: '<h2>What is unified content preparation?</h2>\n<p>Unified content preparation is the process of structuring your site content for consumption by both humans and AI agents.</p>',
      },
      page.url,
    );
  }
}
