import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext, PageContext } from '../../check-context';
import { flattenJsonLd } from '../../parser';

function matchesType(schema: Record<string, unknown>, type: string): boolean {
  const t = schema['@type'];
  if (typeof t === 'string') return t === type;
  if (Array.isArray(t)) return t.includes(type);
  return false;
}

function extractHeadings(page: PageContext): string[] {
  const headings: string[] = [];
  page.$('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const text = page.$(el).text().trim();
    if (text) headings.push(text);
  });
  return headings;
}

function hasQuestionHeadings(page: PageContext): boolean {
  return extractHeadings(page).some((h) => h.endsWith('?'));
}

export class FaqPageSchemaAudit extends Audit {
  static override meta: AuditMeta = {
    id: '3.7',
    category: 'structured-data',
    title: 'FAQPage schema',
    failureTitle: 'FAQPage schema',
    description:
      'AI answer engines like Perplexity and Google SGE extract FAQ-structured content with higher confidence for direct answers. FAQPage schema makes your Q&A content machine-readable, giving it priority in AI-generated responses over unstructured text.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI answer engines like Perplexity and Google SGE give priority to FAQ-structured content for direct answers. Without FAQPage schema, your Q&A content is treated as unstructured text and is less likely to be surfaced as a featured answer in AI-generated responses.',
      fix: 'Add FAQPage JSON-LD to every page that contains question-answer content. Each question should be a Question type with an acceptedAnswer of type Answer.',
      code: `{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is your return policy?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "We offer a 30-day money-back guarantee on all purchases."
      }
    }
  ]
}`,
      effort: 'easy',
      docsUrl: 'https://schema.org/FAQPage',
      tags: ['json-ld', 'schema', 'faq', 'content'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const pagesWithQuestions = ctx.pages.filter((p) => hasQuestionHeadings(p));

    if (pagesWithQuestions.length === 0) {
      return this.warn(
        'No pages with question-patterned headings detected to evaluate.',
        'FAQPage schema on pages with question-patterned headings.',
        'No question-patterned headings found.',
        {
          priority: 'low',
          description:
            'AI answer engines like Perplexity and Google SGE extract FAQ-structured content with high confidence for direct answers. Consider adding FAQ sections with question-formatted headings and FAQPage schema to your content pages.',
          code: `{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "What is ...?",
    "acceptedAnswer": { "@type": "Answer", "text": "..." }
  }]
}`,
        },
      );
    }

    const pagesWithFaq = pagesWithQuestions.filter((p) => {
      const schemas = flattenJsonLd(p.structuredData ?? p.jsonLd);
      return schemas.some((s) => matchesType(s as Record<string, unknown>, 'FAQPage'));
    });

    const allHave = pagesWithFaq.length === pagesWithQuestions.length;
    const someHave = pagesWithFaq.length > 0;

    if (allHave) {
      return this.pass(
        `FAQPage schema found on all ${pagesWithQuestions.length} page(s) with question headings.`,
        'FAQPage schema on pages with question-patterned headings.',
        `${pagesWithFaq.length}/${pagesWithQuestions.length} pages with FAQPage schema`,
      );
    }

    if (someHave) {
      return this.warn(
        `FAQPage schema found on ${pagesWithFaq.length} of ${pagesWithQuestions.length} page(s) with question headings.`,
        'FAQPage schema on pages with question-patterned headings.',
        `${pagesWithFaq.length}/${pagesWithQuestions.length} pages with FAQPage schema`,
        {
          priority: 'medium',
          description:
            'AI answer engines like Perplexity and Google SGE extract FAQ-structured content with higher confidence for direct answers. FAQPage schema makes your Q&A content machine-readable, giving it priority in AI-generated responses over unstructured text.',
          code: `{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "What is ...?",
    "acceptedAnswer": { "@type": "Answer", "text": "..." }
  }]
}`,
        },
      );
    }

    return this.fail(
      `No FAQPage schema found on ${pagesWithQuestions.length} page(s) with question headings.`,
      'FAQPage schema on pages with question-patterned headings.',
      `${pagesWithFaq.length}/${pagesWithQuestions.length} pages with FAQPage schema`,
      {
        priority: 'medium',
        description:
          'AI answer engines like Perplexity and Google SGE extract FAQ-structured content with higher confidence for direct answers. FAQPage schema makes your Q&A content machine-readable, giving it priority in AI-generated responses over unstructured text.',
        code: `{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "What is ...?",
    "acceptedAnswer": { "@type": "Answer", "text": "..." }
  }]
}`,
      },
    );
  }
}
