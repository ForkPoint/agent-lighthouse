import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';

export class SemanticListsAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'content-extraction/semantic-lists',
    category: 'content-extraction',
    title: 'Semantic list usage',
    failureTitle: 'Semantic list usage',
    description:
      'AI agents recognize <ul>, <ol>, and <dl> as structured data lists and extract them as bullet points in generated answers. Content formatted as styled divs instead of semantic lists is invisible to list-extraction algorithms, meaning your feature lists and step-by-step content will not be surfaced as structured answers.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier: 'docs/evidence/audits/content-extraction/semantic-lists.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI agents recognize <ul>, <ol>, and <dl> as structured lists and extract them as bullet points or numbered steps in generated answers. Content formatted as styled <div> elements instead of semantic lists is invisible to list-extraction algorithms, so your feature lists and step-by-step instructions will not be surfaced as structured answers.',
      fix: 'Replace styled <div> elements used as lists with proper <ul> (unordered), <ol> (ordered), or <dl> (definition) elements. Use <ol> for sequential steps, <ul> for unordered items, and <dl> for term-definition pairs.',
      code: '<ul>\n  <li>Feature one: description</li>\n  <li>Feature two: description</li>\n</ul>\n\n<ol>\n  <li>Step one</li>\n  <li>Step two</li>\n</ol>',
      effort: 'easy',
      docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/ul',
      tags: ['lists', 'structure', 'semantic', 'html'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    let pagesWithSemanticLists = 0;

    for (const page of ctx.pages) {
      const $ = page.$;
      const hasLists = $('ul').length > 0 || $('ol').length > 0 || $('dl').length > 0;
      if (hasLists) pagesWithSemanticLists++;
    }

    const allPass = pagesWithSemanticLists === ctx.pages.length;
    const majorityPass = pagesWithSemanticLists > ctx.pages.length / 2;

    if (allPass) {
      return this.pass(
        'All pages use semantic list elements (<ul>, <ol>, <dl>).',
        'Lists use <ul>, <ol>, or <dl> instead of styled divs',
        `${pagesWithSemanticLists}/${ctx.pages.length} pages with semantic lists`,
      );
    }

    if (majorityPass) {
      return this.warn(
        `${pagesWithSemanticLists}/${ctx.pages.length} page(s) use semantic list elements.`,
        'Lists use <ul>, <ol>, or <dl> instead of styled divs',
        `${pagesWithSemanticLists}/${ctx.pages.length} pages with semantic lists`,
        {
          priority: 'medium',
          description:
            'AI agents recognize <ul>, <ol>, and <dl> as structured data lists and extract them as bullet points in generated answers. Content formatted as styled divs instead of semantic lists is invisible to list-extraction algorithms, meaning your feature lists and step-by-step content will not be surfaced as structured answers.',
          code: '<ul>\n  <li>Feature one</li>\n  <li>Feature two</li>\n</ul>',
        },
      );
    }

    return this.fail(
      `${pagesWithSemanticLists}/${ctx.pages.length} page(s) use semantic list elements.`,
      'Lists use <ul>, <ol>, or <dl> instead of styled divs',
      `${pagesWithSemanticLists}/${ctx.pages.length} pages with semantic lists`,
      {
        priority: 'medium',
        description:
          'AI agents recognize <ul>, <ol>, and <dl> as structured data lists and extract them as bullet points in generated answers. Content formatted as styled divs instead of semantic lists is invisible to list-extraction algorithms, meaning your feature lists and step-by-step content will not be surfaced as structured answers.',
        code: '<ul>\n  <li>Feature one</li>\n  <li>Feature two</li>\n</ul>',
      },
    );
  }
}
