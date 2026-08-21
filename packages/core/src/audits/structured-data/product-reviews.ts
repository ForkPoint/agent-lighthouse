// TODO(merge): folds into structured-data/review-schema in Plan 4 (approved 2026-08-21).

import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import { flattenJsonLd } from '../../parser';

export class ProductReviewsAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'structured-data/product-reviews',
    category: 'structured-data',
    title: 'Product reviews and ratings',
    failureTitle: 'Product reviews and ratings',
    description:
      'AI agents often rank products based on user ratings and review volume. Providing AggregateRating schema allows agents to confidently recommend highly-rated items to users.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/structured-data/product-reviews.md',
    applicablePageTypes: ['product'],
    defaultPriority: 'low',
    guidance: {
      impact:
        'AI agents rank products based on user ratings and review volume. Without AggregateRating schema, agents cannot include your social proof in their recommendations, making your products less competitive in AI-generated "best of" lists and comparison answers.',
      fix: 'Add an aggregateRating property to your Product JSON-LD. Include ratingValue, reviewCount, and bestRating to give AI agents full rating context.',
      code: `{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Product Name",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "reviewCount": "125",
    "bestRating": "5"
  }
}`,
      effort: 'easy',
      docsUrl: 'https://schema.org/AggregateRating',
      tags: ['json-ld', 'schema', 'product', 'ecommerce', 'reviews', 'ratings'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const schemas = ctx.pages.flatMap((p) => flattenJsonLd(p.structuredData ?? p.jsonLd));
    const ratings = schemas.filter((s) => {
      const rec = s as Record<string, unknown>;
      return (
        rec['@type'] === 'AggregateRating' ||
        (rec['aggregateRating'] && typeof rec['aggregateRating'] === 'object')
      );
    });

    if (ratings.length > 0) {
      return this.pass(
        'Found AggregateRating schema.',
        'AggregateRating schema with ratingValue and reviewCount.',
        'Found',
      );
    }

    return this.warn(
      'No product ratings found in structured data.',
      'AggregateRating schema with ratingValue and reviewCount.',
      'None',
      {
        priority: 'low',
        description:
          'AI agents use "AggregateRating" to include social proof in their recommendations. Consider adding it to your Product pages.',
        code: `{
  "@type": "Product",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "reviewCount": "125"
  }
}`,
      },
    );
  }
}
