import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { isArticleContentPage } from './dates-on-content';

const wordCount = (s: string): number => s.split(/\s+/).filter(Boolean).length;

export class DirectDefinitionsAudit extends Audit {
  static override meta: AuditMeta = {
    id: '9.4',
    category: 'answer-engine',
    title: 'Direct definitions for key terms',
    failureTitle: 'Direct definitions for key terms',
    description:
      'AI engines extract term-definition pairs to generate direct-answer snippets for "what is X?" queries. Use <dfn>, <dl>, or bold-colon patterns to mark up key terms.',
    scoreDisplayMode: 'binary',
    weight: 1.0,
    applicablePageTypes: ['content'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI engines extract term-definition pairs to generate direct-answer snippets for "what is X?" queries. Without explicit definition markup, agents must infer definitions from surrounding text, reducing your chances of being selected as a direct answer.',
      fix: 'Use <dfn>, <dl>/<dt>/<dd>, or bold-colon patterns ("<strong>Term:</strong> definition") to mark up key terms and their definitions throughout your content.',
      code: '<dl>\n  <dt><dfn>Unified Content Preparation</dfn></dt>\n  <dd>The process of structuring site content for consumption by both humans and AI agents.</dd>\n</dl>',
      effort: 'easy',
      tags: ['content-structure', 'html', 'answer-engine'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    // Scope to article content. On product pages, "<strong>Weight:</strong> 200g"
    // spec labels look like definitions but are not — so we require the markup
    // to introduce a real, sentence-length definition.
    const contentPages = ctx.pages.filter(isArticleContentPage);
    if (contentPages.length === 0) {
      return this.notApplicable(
        'No article content pages were scanned, so definition formatting does not apply.',
        'Definition-style formatting (<dfn>, sentence-length <dl>, or bold-colon + sentence)',
        'No content pages',
      );
    }

    const signals: string[] = [];

    for (const p of contentPages) {
      const $ = p.$;

      // <dfn> is unambiguous definition markup.
      const dfnCount = $('dfn').length;
      if (dfnCount > 0) {
        signals.push(`<dfn> (${dfnCount})`);
      }

      // <dl> only counts when at least one <dd> is sentence-length — product
      // spec tables ("Weight: 200g") have terse, fragment <dd> values.
      let sentenceDd = 0;
      $('dl dd').each((_, el) => {
        const t = $(el).text().replace(/\s+/g, ' ').trim();
        if (wordCount(t) >= 6) sentenceDd++;
      });
      if (sentenceDd > 0) {
        signals.push(`<dl> with sentence definitions (${sentenceDd})`);
      }

      // Bold-colon ("<strong>Term:</strong> …") counts only when the text that
      // FOLLOWS the colon is a sentence, not a short spec value.
      let boldColonDefs = 0;
      $('strong, b').each((_, el) => {
        const label = $(el).text().replace(/\s+/g, ' ').trim();
        if (!label.endsWith(':')) return;
        const parentText = $(el).parent().text().replace(/\s+/g, ' ').trim();
        const after = parentText.slice(parentText.indexOf(label) + label.length).trim();
        if (wordCount(after) >= 6) boldColonDefs++;
      });
      if (boldColonDefs > 0) {
        signals.push(`bold-colon definitions (${boldColonDefs})`);
      }
    }

    if (signals.length > 0) {
      return this.pass(
        `Definition-style formatting found: ${signals.join(', ')}.`,
        'Definition-style formatting (<dfn>, sentence-length <dl>, or bold-colon + sentence)',
        signals.join(', '),
        contentPages[0].url,
      );
    }

    return this.fail(
      'No definition-style formatting found (<dfn>, sentence-length <dl>, or bold-colon + sentence).',
      'Definition-style formatting (<dfn>, sentence-length <dl>, or bold-colon + sentence)',
      'Not found',
      {
        priority: 'medium',
        description:
          'AI engines use <dfn>, <dl>, and bold-colon patterns ("**Term:** definition") to extract term-definition pairs for "what is X?" answer snippets. Without explicit definition markup, agents must infer definitions from surrounding text, which is less reliable and reduces your content\'s chances of being selected as a direct answer.',
        code: '<dl>\n  <dt><dfn>Unified Content Preparation</dfn></dt>\n  <dd>The process of structuring site content for consumption by both humans and AI agents.</dd>\n</dl>',
      },
      contentPages[0].url,
    );
  }
}
