import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';

export class SectionHeadingsAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'content-extraction/section-headings',
    category: 'content-extraction',
    title: '<section> elements have headings or labels',
    failureTitle: '<section> elements have headings or labels',
    description:
      'AI agents use section headings to build a topic map of your page for retrieval-augmented generation (RAG). Unlabeled sections are opaque to AI systems that chunk content by semantic boundaries, reducing the quality of retrieved context for answer generation.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier: 'docs/evidence/audits/content-extraction/section-headings.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI agents use section headings to build a topic map of your page for retrieval-augmented generation. Unlabeled <section> elements are opaque to AI chunking systems, preventing them from indexing and retrieving your content by topic, which reduces your visibility in AI-generated answers.',
      fix: 'Add a heading (h2-h6) as the first child of every <section> element, or use aria-label/aria-labelledby if a visible heading is not appropriate for the design. Every section should have a clear, descriptive label.',
      code: '<section>\n  <h2>Pricing Plans</h2>\n  <p>Choose the plan that fits your needs...</p>\n</section>\n\n<!-- Or with aria-label for visually hidden labels: -->\n<section aria-label="Customer testimonials">\n  <!-- Content without a visible heading -->\n</section>',
      effort: 'easy',
      docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/section',
      tags: ['sections', 'headings', 'structure', 'semantic', 'html'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    let totalSections = 0;
    let labeledSections = 0;

    for (const page of ctx.pages) {
      const $ = page.$;
      $('section').each((_, el) => {
        totalSections++;
        const hasHeading =
          $(el).find('> h1, > h2, > h3, > h4, > h5, > h6').length > 0 ||
          $(el).find('h1, h2, h3, h4, h5, h6').length > 0;
        const hasAriaLabel = !!$(el).attr('aria-label');
        const hasAriaLabelledby = !!$(el).attr('aria-labelledby');

        if (hasHeading || hasAriaLabel || hasAriaLabelledby) {
          labeledSections++;
        }
      });
    }

    if (totalSections === 0) {
      return this.warn(
        'No <section> elements found on any page.',
        'All <section> elements have a heading or aria-label',
        'No <section> elements',
        {
          priority: 'medium',
          description:
            'AI agents use <section> elements with headings to identify thematic content groups for chunked retrieval. Consider using <section> elements to group related content, each with a descriptive heading that AI systems can use for topic classification.',
          code: '<section>\n  <h2>Section Topic</h2>\n  <p>Content about this topic...</p>\n</section>',
        },
      );
    }

    const allLabeled = labeledSections === totalSections;
    const majorityLabeled = labeledSections > totalSections / 2;

    if (allLabeled) {
      return this.pass(
        `All ${totalSections} <section> element(s) have a heading or label.`,
        'All <section> elements have a heading child or aria-label/aria-labelledby',
        `${labeledSections}/${totalSections} labeled sections`,
      );
    }

    if (majorityLabeled) {
      return this.warn(
        `${labeledSections}/${totalSections} <section> element(s) have a heading or label.`,
        'All <section> elements have a heading child or aria-label/aria-labelledby',
        `${labeledSections}/${totalSections} labeled sections`,
        {
          priority: 'medium',
          description:
            'AI agents use section headings to build a topic map of your page for retrieval-augmented generation (RAG). Unlabeled sections are opaque to AI systems that chunk content by semantic boundaries, reducing the quality of retrieved context for answer generation.',
          code: '<section aria-label="Pricing details">\n  <h2>Pricing</h2>\n  <p>Content...</p>\n</section>',
        },
      );
    }

    return this.fail(
      `${labeledSections}/${totalSections} <section> element(s) have a heading or label.`,
      'All <section> elements have a heading child or aria-label/aria-labelledby',
      `${labeledSections}/${totalSections} labeled sections`,
      {
        priority: 'medium',
        description:
          'AI agents use section headings to build a topic map of your page for retrieval-augmented generation (RAG). Unlabeled sections are opaque to AI systems that chunk content by semantic boundaries, reducing the quality of retrieved context for answer generation.',
        code: '<section aria-label="Pricing details">\n  <h2>Pricing</h2>\n  <p>Content...</p>\n</section>',
      },
    );
  }
}
