import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext, PageContext } from '../../check-context';
import { extractHeadings, flattenJsonLd } from '../../parser';

// Matches FAQ section labels in headings/summaries: "Frequently Asked
// Questions", "FAQ(s)", "Common Questions", "Questions & Answers", "Q&A".
const FAQ_TEXT =
  /frequently\s+asked\s+questions|\bFAQ['']?s?\b|common\s+questions|questions?\s*(?:&|and)\s*answers|\bQ\s*&\s*A\b/i;

/** True when the page carries FAQPage JSON-LD (robust to nesting/@graph). */
function hasFaqJsonLd(p: PageContext): boolean {
  for (const node of flattenJsonLd(p.structuredData ?? p.jsonLd)) {
    const t = (node as Record<string, unknown>)['@type'];
    if (typeof t === 'string' && /faqpage/i.test(t)) return true;
    if (Array.isArray(t) && t.some((x) => typeof x === 'string' && /faqpage/i.test(x))) return true;
  }
  return false;
}

export class FaqSectionsAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'answer-readiness/faq-sections',
    category: 'answer-readiness',
    title: 'FAQ sections present',
    failureTitle: 'FAQ sections present',
    description:
      'AI answer engines like Perplexity extract FAQ-structured content with higher confidence for direct answers. FAQ sections with clear question headings are the top extraction target for "People Also Ask" results and conversational AI responses.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/answer-readiness/faq-sections.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'FAQ sections with clear question headings are the highest-priority extraction target for AI-generated answers and "People Also Ask" results. Without them, your content misses the most direct path to appearing in AI answer snippets.',
      fix: 'Add a "Frequently Asked Questions" section with question-formatted H3 headings, each followed immediately by a concise answer paragraph.',
      code: '<h2>Frequently Asked Questions</h2>\n<h3>What is your return policy?</h3>\n<p>We offer a 30-day money-back guarantee on all products.</p>\n<h3>How long does shipping take?</h3>\n<p>Standard shipping takes 3-5 business days within the US.</p>',
      effort: 'easy',
      tags: ['content-structure', 'faq', 'answer-engine'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    if (!page) {
      return this.fail(
        'No pages scanned.',
        'Headings containing "Frequently Asked Questions" or "FAQ"',
        'No pages scanned',
        {
          priority: 'medium',
          description: FaqSectionsAudit.meta.description,
          code: '<h2>Frequently Asked Questions</h2>\n<h3>What is your return policy?</h3>\n<p>We offer a 30-day money-back guarantee on all products.</p>',
        },
      );
    }

    for (const p of ctx.pages) {
      const $ = p.$;

      // 1. FAQPage structured data — the strongest signal.
      if (hasFaqJsonLd(p)) {
        return this.pass(
          'Found FAQPage structured data (JSON-LD).',
          'FAQ heading, FAQPage JSON-LD, or an accordion of questions',
          'FAQPage JSON-LD',
          p.url,
        );
      }

      // 2. Heading / summary text matching FAQ phrasings.
      const headings = extractHeadings($);
      const faqHeadings = headings.filter((h) => FAQ_TEXT.test(h.text));
      const faqSummaries: string[] = [];
      $('details summary, summary').each((_, el) => {
        const t = $(el).text().trim();
        if (FAQ_TEXT.test(t)) faqSummaries.push(t);
      });
      const labels = [...faqHeadings.map((h) => h.text), ...faqSummaries];
      if (labels.length > 0) {
        return this.pass(
          `Found ${labels.length} FAQ label(s): "${labels[0]}".`,
          'FAQ heading, FAQPage JSON-LD, or an accordion of questions',
          labels.join('; '),
          p.url,
        );
      }

      // 3. FAQ accordions: class/id containing "faq", or <details>/<summary>
      // whose summaries read as questions.
      const faqAccordions = $('[class], [id]').filter((_, el) => {
        const cls = ($(el).attr('class') ?? '').toLowerCase();
        const id = ($(el).attr('id') ?? '').toLowerCase();
        return /faq/.test(cls) || /faq/.test(id);
      });
      const questionSummaries = $('details summary').filter((_, el) =>
        /\?\s*$/.test($(el).text().trim()),
      );
      if (faqAccordions.length > 0 || questionSummaries.length > 0) {
        const detail =
          faqAccordions.length > 0
            ? `${faqAccordions.length} FAQ container(s)`
            : `${questionSummaries.length} question accordion(s)`;
        return this.pass(
          `Found an FAQ-style accordion (${detail}).`,
          'FAQ heading, FAQPage JSON-LD, or an accordion of questions',
          detail,
          p.url,
        );
      }
    }

    return this.fail(
      'No FAQ sections found (headings, FAQPage JSON-LD, or accordions).',
      'FAQ heading, FAQPage JSON-LD, or an accordion of questions',
      'Not found',
      {
        priority: 'medium',
        description:
          'FAQ sections with clear question headings are the highest-priority extraction target for AI-generated answers. Structure each Q&A with a question heading followed by a direct answer paragraph.',
        code: '<h2>Frequently Asked Questions</h2>\n<h3>What is your return policy?</h3>\n<p>We offer a 30-day money-back guarantee on all products.</p>\n<h3>How long does shipping take?</h3>\n<p>Standard shipping takes 3-5 business days within the US.</p>',
      },
      page.url,
    );
  }
}
