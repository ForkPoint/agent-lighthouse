import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext, PageContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import { flattenJsonLd } from '../../parser';

function matchesAnyType(schema: Record<string, unknown>, types: string[]): boolean {
  return types.some((t) => {
    const st = schema['@type'];
    if (typeof st === 'string') return st === t;
    if (Array.isArray(st)) return st.includes(t);
    return false;
  });
}

function allSchemas(ctx: CheckContext): object[] {
  return ctx.pages.flatMap((p) => flattenJsonLd(p.structuredData ?? p.jsonLd));
}

function hasTestimonialContent(page: PageContext): boolean {
  const body = page.$('body').text().toLowerCase();
  /* v8 ignore next */
  const html = page.$('body').html()?.toLowerCase() ?? '';
  const textPatterns = [
    /\btestimonial/i,
    /\breview/i,
    /\brating/i,
    /\bstars?\b/i,
    /\bcustomer\s+feedback\b/i,
  ];
  const classPatterns = [/class="[^"]*testimonial/i, /class="[^"]*review/i, /class="[^"]*rating/i];
  return textPatterns.some((p) => p.test(body)) || classPatterns.some((p) => p.test(html));
}

export class ReviewSchemaAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'structured-data/review-schema',
    category: 'structured-data',
    title: 'Review/AggregateRating schema',
    failureTitle: 'Review/AggregateRating schema',
    description:
      'AI agents use Review/AggregateRating schema as social proof when comparing options. When a user asks "what is the best X?", agents surface structured ratings from schema rather than parsing unstructured testimonial text. Add this schema to make your reviews machine-readable.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/structured-data/review-schema.md',
    applicablePageTypes: ['homepage', 'product'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'When users ask AI agents "what is the best X?", agents surface structured ratings from Review/AggregateRating schema rather than parsing unstructured testimonial text. Without this schema, your customer reviews and social proof are invisible to AI-driven comparisons and recommendations.',
      fix: 'Add AggregateRating or Review JSON-LD to pages with testimonials or reviews. For aggregate ratings, include ratingValue and reviewCount. For individual reviews, include author, reviewRating, and reviewBody.',
      code: `{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Your Product",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "reviewCount": "150"
  },
  "review": {
    "@type": "Review",
    "author": { "@type": "Person", "name": "Customer Name" },
    "reviewRating": { "@type": "Rating", "ratingValue": "5" },
    "reviewBody": "Excellent product, highly recommend."
  }
}`,
      effort: 'moderate',
      docsUrl: 'https://schema.org/AggregateRating',
      tags: ['json-ld', 'schema', 'reviews', 'ratings', 'social-proof'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const pagesWithTestimonials = ctx.pages.filter((p) => hasTestimonialContent(p));

    if (pagesWithTestimonials.length === 0) {
      return this.warn(
        'No testimonial or review content detected to evaluate.',
        'Review or AggregateRating schema on pages with testimonials or reviews.',
        'No testimonial/review content found.',
        {
          priority: 'low',
          description:
            'AI agents use Review and AggregateRating schema as trust signals when recommending products or services. If you have customer reviews or testimonials, marking them up with schema makes them available for AI-generated comparisons and recommendations.',
          code: `"aggregateRating": {
  "@type": "AggregateRating",
  "ratingValue": "4.8",
  "reviewCount": "150"
}`,
        },
      );
    }

    const schemas = allSchemas(ctx);
    const reviewSchemas = schemas.filter((s) =>
      matchesAnyType(s as Record<string, unknown>, ['Review', 'AggregateRating']),
    );

    // Also check if any schema has aggregateRating or review property
    const schemasWithReviewProp = schemas.filter((s) => {
      const obj = s as Record<string, unknown>;
      return obj['aggregateRating'] || obj['review'];
    });

    const found = reviewSchemas.length > 0 || schemasWithReviewProp.length > 0;

    if (found) {
      return this.pass(
        'Review or AggregateRating structured data found.',
        'Review or AggregateRating schema on pages with testimonials or reviews.',
        `${reviewSchemas.length} Review/AggregateRating schema(s), ${schemasWithReviewProp.length} schema(s) with review properties`,
      );
    }

    return this.fail(
      'Testimonial/review content detected but no Review or AggregateRating schema found.',
      'Review or AggregateRating schema on pages with testimonials or reviews.',
      'None',
      {
        priority: 'medium',
        description:
          'AI agents use Review/AggregateRating schema as social proof when comparing options. When a user asks "what is the best X?", agents surface structured ratings from schema rather than parsing unstructured testimonial text. Add this schema to make your reviews machine-readable.',
        code: `"aggregateRating": {
  "@type": "AggregateRating",
  "ratingValue": "4.8",
  "reviewCount": "150"
}`,
      },
    );
  }
}
