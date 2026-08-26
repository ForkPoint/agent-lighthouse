import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext, PageContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
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

function hasSequentialNumberedHeadings(page: PageContext): boolean {
  const headings = extractHeadings(page);
  let seqCount = 0;
  let expectedNum = 1;
  for (const h of headings) {
    const match = h.match(/^(?:step\s+)?(\d+)[.):\s]/i);
    if (match && parseInt(match[1], 10) === expectedNum) {
      seqCount++;
      expectedNum++;
    }
  }
  return seqCount >= 2;
}

export class HowToSchemaAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'structured-data/howto-schema',
    category: 'structured-data',
    title: 'HowTo schema',
    failureTitle: 'HowTo schema',
    description:
      'AI agents use HowTo schema to present step-by-step instructions as structured answers. Without it, agents must parse your numbered headings heuristically, which often breaks step ordering or misses steps entirely.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/structured-data/howto-schema.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    applicablePageTypes: ['content'],
    defaultPriority: 'low',
    guidance: {
      impact:
        'Without HowTo schema, AI agents must heuristically parse your numbered headings to extract step-by-step instructions. This often results in broken step ordering, missed steps, or incomplete instructions in AI-generated answers, reducing your content utility.',
      fix: 'Add HowTo JSON-LD to pages with step-by-step instructions. Include a step array with HowToStep items, each containing name and text properties.',
      code: `{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to set up your account",
  "step": [
    { "@type": "HowToStep", "name": "Create an account", "text": "Visit the signup page and fill in your details." },
    { "@type": "HowToStep", "name": "Verify your email", "text": "Click the link in the confirmation email." }
  ]
}`,
      effort: 'easy',
      docsUrl: 'https://schema.org/HowTo',
      tags: ['json-ld', 'schema', 'content', 'how-to', 'instructions'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const pagesWithSteps = ctx.pages.filter((p) => hasSequentialNumberedHeadings(p));

    if (pagesWithSteps.length === 0) {
      return this.warn(
        'No pages with sequential numbered headings detected to evaluate.',
        'HowTo schema with step array on pages with sequential numbered headings.',
        'No sequential numbered headings found.',
        {
          priority: 'low',
          description:
            'AI agents use HowTo schema to present step-by-step instructions as structured answers. If your content includes processes or tutorials, add HowTo JSON-LD so agents can walk users through steps one at a time.',
          code: `{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to ...",
  "step": [
    { "@type": "HowToStep", "name": "Step 1", "text": "..." },
    { "@type": "HowToStep", "name": "Step 2", "text": "..." }
  ]
}`,
        },
      );
    }

    const pagesWithHowTo = pagesWithSteps.filter((p) => {
      const schemas = flattenJsonLd(p.structuredData ?? p.jsonLd);
      return schemas.some((s) => {
        const obj = s as Record<string, unknown>;
        return matchesType(obj, 'HowTo') && Array.isArray(obj['step']);
      });
    });

    const allHave = pagesWithHowTo.length === pagesWithSteps.length;
    const someHave = pagesWithHowTo.length > 0;

    if (allHave) {
      return this.pass(
        `HowTo schema with steps found on all ${pagesWithSteps.length} page(s) with sequential headings.`,
        'HowTo schema with step array on pages with sequential numbered headings.',
        `${pagesWithHowTo.length}/${pagesWithSteps.length} pages with HowTo schema`,
      );
    }

    if (someHave) {
      return this.warn(
        `HowTo schema found on ${pagesWithHowTo.length} of ${pagesWithSteps.length} page(s) with sequential headings.`,
        'HowTo schema with step array on pages with sequential numbered headings.',
        `${pagesWithHowTo.length}/${pagesWithSteps.length} pages with HowTo schema`,
        {
          priority: 'low',
          description:
            'AI agents use HowTo schema to present step-by-step instructions as structured answers. Without it, agents must parse your numbered headings heuristically, which often breaks step ordering or misses steps entirely.',
          code: `{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to ...",
  "step": [
    { "@type": "HowToStep", "name": "Step 1", "text": "..." },
    { "@type": "HowToStep", "name": "Step 2", "text": "..." }
  ]
}`,
        },
      );
    }

    return this.fail(
      `No HowTo schema found on ${pagesWithSteps.length} page(s) with sequential headings.`,
      'HowTo schema with step array on pages with sequential numbered headings.',
      `${pagesWithHowTo.length}/${pagesWithSteps.length} pages with HowTo schema`,
      {
        priority: 'low',
        description:
          'AI agents use HowTo schema to present step-by-step instructions as structured answers. Without it, agents must parse your numbered headings heuristically, which often breaks step ordering or misses steps entirely.',
        code: `{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to ...",
  "step": [
    { "@type": "HowToStep", "name": "Step 1", "text": "..." },
    { "@type": "HowToStep", "name": "Step 2", "text": "..." }
  ]
}`,
      },
    );
  }
}
