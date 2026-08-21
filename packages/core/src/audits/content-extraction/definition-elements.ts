// TODO(merge): folds into content-extraction/semantic-lists in Plan 4 (approved 2026-08-21).

import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';

export class DefinitionElementsAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'content-extraction/definition-elements',
    category: 'content-extraction',
    title: 'Definition elements',
    failureTitle: 'Definition elements',
    description:
      'AI agents use <dfn> and <dl> elements to extract term-definition pairs for "what is X?" queries. Semantic definition markup makes your glossary terms and key concepts directly extractable as AI-generated answer snippets.',
    scoreDisplayMode: 'binary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier: 'docs/evidence/audits/content-extraction/definition-elements.md',
    applicablePageTypes: ['content'],
    defaultPriority: 'low',
    guidance: {
      impact:
        'AI agents use <dfn> and <dl> elements to extract term-definition pairs for "what is X?" queries. Without semantic definition markup, your glossary terms and key concepts cannot be directly surfaced as AI-generated answer snippets.',
      fix: 'Use <dl> (definition list) with <dt> (term) and <dd> (definition) pairs for glossaries, FAQs, and key-value content. Use <dfn> inline to mark the defining instance of a term within running text.',
      code: '<dl>\n  <dt><dfn>API Rate Limit</dfn></dt>\n  <dd>The maximum number of requests allowed per time period.</dd>\n</dl>',
      effort: 'easy',
      docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dl',
      tags: ['definitions', 'glossary', 'semantic', 'html'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    let pagesWithDefinitions = 0;

    for (const page of ctx.pages) {
      const $ = page.$;
      if ($('dfn').length > 0 || $('dl').length > 0) pagesWithDefinitions++;
    }

    const hasDefinitions = pagesWithDefinitions > 0;

    if (hasDefinitions) {
      return this.pass(
        `${pagesWithDefinitions}/${ctx.pages.length} page(s) use definition elements (<dfn> or <dl>).`,
        '<dfn> or <dl> elements used for definitions',
        `${pagesWithDefinitions} page(s) with definition elements`,
      );
    }

    return this.warn(
      'No <dfn> or <dl> elements found. Consider using them for glossary terms or key-value content.',
      '<dfn> or <dl> elements used for definitions',
      'No definition elements found',
      {
        priority: 'low',
        description:
          'AI agents use <dfn> and <dl> elements to extract term-definition pairs for "what is X?" queries. Semantic definition markup makes your glossary terms and key concepts directly extractable as AI-generated answer snippets.',
        code: '<dl>\n  <dt><dfn>Term</dfn></dt>\n  <dd>Definition of the term in clear language.</dd>\n</dl>',
      },
    );
  }
}
