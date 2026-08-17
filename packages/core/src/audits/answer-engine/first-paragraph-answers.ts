import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { isArticleContentPage } from './dates-on-content';

const WEAK_OPENERS = [
  /^in this (article|post|guide|page)/i,
  /^welcome/i,
  /^(what|how|why|when|where|who|which|can|do|does|is|are|will|should)\b.*\?$/i,
  /^have you ever/i,
  /^did you know/i,
];

export class FirstParagraphAnswersAudit extends Audit {
  static override meta: AuditMeta = {
    id: '9.3',
    category: 'answer-engine',
    title: 'First paragraph answers primary question',
    failureTitle: 'First paragraph answers primary question',
    description:
      'AI search engines score the first paragraph highest for extractive QA. Preamble text like "In this article" or "Welcome" wastes this prime position, causing agents to extract low-value content as your page\'s representative answer.',
    scoreDisplayMode: 'binary',
    weight: 1.0,
    applicablePageTypes: ['content'],
    defaultPriority: 'high',
    guidance: {
      impact:
        'AI search engines score the first paragraph highest for extractive QA. Preamble text like "In this article" or "Welcome" wastes this prime position, causing agents to extract low-value filler as your page\'s representative answer.',
      fix: 'Rewrite the first paragraph in <main> as a direct, declarative answer to the page\'s primary question. Remove preamble phrases like "In this article", "Welcome", or rhetorical questions.',
      code: '<main>\n  <p>Unified content preparation optimizes your site for AI agents by structuring content with semantic HTML, JSON-LD, and machine-readable metadata.</p>\n</main>',
      effort: 'easy',
      tags: ['content-quality', 'copywriting', 'answer-engine'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    // Only meaningful on article/content pages: on a JS storefront homepage the
    // first <p> in source order is utility chrome ("Search", "Redirecting…"),
    // which used to false-pass this check.
    const page = ctx.pages.find(isArticleContentPage);
    if (!page) {
      return this.notApplicable(
        'No article content pages were scanned, so the first-paragraph check does not apply.',
        'First substantive <p> on a content page is a declarative answer, not a filler intro',
        'No content pages',
      );
    }

    const $ = page.$;
    const mainEl = $('main').first();
    const container = mainEl.length ? mainEl : $('body');

    // Pick the first SUBSTANTIVE paragraph: skip empty/short utility paragraphs
    // (nav, breadcrumbs, cookie banners) by requiring real prose — ≥15 words
    // and at least one sentence terminator.
    let firstP = '';
    container.find('p').each((_, el) => {
      const t = $(el).text().replace(/\s+/g, ' ').trim();
      const wordCount = t.split(/\s+/).filter(Boolean).length;
      if (wordCount >= 15 && /[a-z][.!?](\s|$|["'’”)])/.test(t)) {
        firstP = t;
        return false;
      }
      return undefined;
    });

    if (!firstP) {
      return this.fail(
        'No substantive opening paragraph found in the main content area.',
        'First substantive <p> on a content page is a declarative answer, not a filler intro',
        'No substantive <p> found',
        {
          priority: 'high',
          description:
            'Without a substantive first paragraph, agents have no candidate answer to extract from your page. Add a direct, declarative opening paragraph to your main content area.',
          code: '<main>\n  <p>Your direct answer to the page topic goes here as the first paragraph.</p>\n</main>',
        },
        page.url,
      );
    }

    const isWeak = WEAK_OPENERS.some((pattern) => pattern.test(firstP));

    if (!isWeak) {
      return this.pass(
        'First paragraph appears to be a direct, declarative answer.',
        'First substantive <p> on a content page is a declarative answer, not a filler intro',
        firstP.length > 120 ? firstP.slice(0, 120) + '...' : firstP,
        page.url,
      );
    }

    return this.fail(
      'First paragraph starts with a weak opener instead of a direct answer.',
      'First substantive <p> on a content page is a declarative answer, not a filler intro',
      firstP.length > 120 ? firstP.slice(0, 120) + '...' : firstP,
      {
        priority: 'high',
        description:
          "Rewrite the first paragraph as a direct, declarative answer to the page's primary question. Preamble text causes agents to extract low-value filler as your page's representative answer.",
        code: '<!-- Instead of "In this article, we explore..." use: -->\n<p>Content preparation for AI agents involves structuring your pages with semantic HTML, adding JSON-LD schema, and providing machine-readable metadata.</p>',
      },
      page.url,
    );
  }
}
