import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext, PageContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import { allJsonLdNodes } from '../../parser';

/** Class-name shapes that mark one repeated review/testimonial component. */
const REVIEW_COMPONENT_CLASS =
  /(testimonial|review[-_ ](item|card|entry|body|text|content|author)|(user|customer|product|verified)[-_ ]review)/i;

/** Class-name shapes that mark a rendered star-rating widget. */
const STAR_WIDGET_CLASS = /(star[-_ ]?rating|rating[-_ ]?stars?|stars?[-_ ]?widget)/i;

/** Schema types whose ratings Google treats as third-party reviewed product-like entities. */
const PRODUCT_TYPES = [
  'Product',
  'ProductGroup',
  'ProductModel',
  'IndividualProduct',
  'SoftwareApplication',
  'MobileApplication',
  'WebApplication',
];

function matchesAnyType(schema: Record<string, unknown>, types: string[]): boolean {
  const st = schema['@type'];
  if (typeof st === 'string') return types.includes(st);
  if (Array.isArray(st)) return st.some((t) => typeof t === 'string' && types.includes(t));
  return false;
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return value === undefined || value === null ? [] : [value];
}

/** Numeric coercion that rejects `null`, `""` and non-numeric strings. */
function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/**
 * Google requires `ratingValue` plus at least one of `ratingCount`/`reviewCount`
 * for a review snippet, so an `aggregateRating` without both carries no
 * consumer — `{}` and `reviewCount: 0` are the zero-review shapes Shopify,
 * Judge.me and Yotpo emit on products nobody has reviewed yet.
 */
function isUsableAggregateRating(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const rec = value as Record<string, unknown>;
  if (toNumber(rec['ratingValue']) === undefined) return false;
  const count = toNumber(rec['reviewCount']) ?? toNumber(rec['ratingCount']);
  return count !== undefined && count > 0;
}

/** A review record counts only when it carries a rating, a body or an author. */
function isUsableReview(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const rec = value as Record<string, unknown>;
  return Boolean(rec['reviewRating'] ?? rec['reviewBody'] ?? rec['author']);
}

function usableReviewCount(value: unknown): number {
  return asArray(value).filter(isUsableReview).length;
}

interface RatingTally {
  /** Usable rating/review records anywhere in the page's graph. */
  total: number;
  /** Usable records attached to a Product-like host entity. */
  onProduct: number;
}

/**
 * Count rating evidence over the flattened graph. Host nodes are counted first
 * so their nested `aggregateRating`/`review` children (visited again by the
 * deep walk) are not double-counted, and so attachment to a Product is known.
 */
function tallyRatings(nodes: object[]): RatingTally {
  let total = 0;
  let onProduct = 0;
  const counted = new Set<object>();

  for (const node of nodes) {
    const rec = node as Record<string, unknown>;
    const rating = rec['aggregateRating'];
    const reviews = rec['review'] ?? rec['reviews'];
    const usable = (isUsableAggregateRating(rating) ? 1 : 0) + usableReviewCount(reviews);
    if (usable === 0) continue;

    total += usable;
    if (matchesAnyType(rec, PRODUCT_TYPES)) onProduct += usable;
    if (rating && typeof rating === 'object') counted.add(rating as object);
    for (const r of asArray(reviews)) if (r && typeof r === 'object') counted.add(r as object);
  }

  for (const node of nodes) {
    if (counted.has(node)) continue;
    const rec = node as Record<string, unknown>;
    if (matchesAnyType(rec, ['AggregateRating']) && isUsableAggregateRating(rec)) total++;
    else if (matchesAnyType(rec, ['Review', 'UserReview', 'CriticReview']) && isUsableReview(rec)) {
      total++;
    }
  }

  return { total, onProduct };
}

/**
 * Structural applicability: repeated review components or a rendered star
 * widget, never the word "review" in body text. The word appears on nearly
 * every English commerce page ("Write a review", a cookie banner's "review your
 * preferences") and on no German, French or Japanese one, so a text gate is
 * always-true in one language and always-false in another.
 */
function hasStructuralReviewContent(page: PageContext): boolean {
  let components = 0;
  let widgets = 0;
  page.$('[class]').each((_, el) => {
    const cls = page.$(el).attr('class') ?? '';
    if (REVIEW_COMPONENT_CLASS.test(cls)) components++;
    if (STAR_WIDGET_CLASS.test(cls)) widgets++;
  });
  components += page.$('[itemtype*="Review"], [itemprop="review"], [itemprop="reviewRating"]').length;
  widgets += page.$('[itemprop="ratingValue"]').length;
  return components >= 3 || widgets >= 1;
}

/** Review markup of any quality — including the empty shapes — is review content. */
function hasReviewMarkup(nodes: object[]): boolean {
  return nodes.some((node) => {
    const rec = node as Record<string, unknown>;
    return (
      matchesAnyType(rec, ['Review', 'UserReview', 'CriticReview', 'AggregateRating']) ||
      rec['aggregateRating'] !== undefined ||
      rec['review'] !== undefined ||
      rec['reviews'] !== undefined
    );
  });
}

const EXPECTED =
  'Review or AggregateRating with ratingValue and a non-zero reviewCount/ratingCount — attached to the Product on product pages.';

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
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    applicablePageTypes: ['homepage', 'product'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'When users ask AI agents "what is the best X?", agents surface structured ratings from Review/AggregateRating schema rather than parsing unstructured testimonial text. Google requires ratingValue plus a ratingCount or reviewCount to render a review snippet, and on a shop the rating has to sit on the Product itself — a site-wide badge does not make any single product eligible.',
      fix: 'Add AggregateRating or Review JSON-LD to the pages that show reviews. Include ratingValue and a non-zero reviewCount (or a non-empty review array with author, reviewRating and reviewBody), and attach it to the Product on product pages rather than only to the Organization.',
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
      docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/review-snippet',
      tags: ['json-ld', 'schema', 'reviews', 'ratings', 'social-proof', 'product'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const findings = ctx.pages.map((page) => {
      const nodes = allJsonLdNodes(page.structuredData ?? page.jsonLd);
      return {
        page,
        hasContent: hasStructuralReviewContent(page) || hasReviewMarkup(nodes),
        ratings: tallyRatings(nodes),
      };
    });

    if (!findings.some((f) => f.hasContent)) {
      return this.notApplicable(
        'No review or testimonial content detected to evaluate.',
        EXPECTED,
        'No review components, star-rating widgets or review markup found.',
      );
    }

    const total = findings.reduce((n, f) => n + f.ratings.total, 0);
    const productPages = findings.filter((f) => f.ratings.onProduct > 0 || /\/(products?|items?|p|dp)\b/i.test(f.page.url));
    const productPagesWithRating = productPages.filter((f) => f.ratings.onProduct > 0);

    if (productPages.length > 0 && productPagesWithRating.length === 0 && total > 0) {
      return this.warn(
        `Ratings found, but none of the ${productPages.length} product page(s) carries a rating attached to its Product.`,
        EXPECTED,
        `${total} usable rating/review record(s), 0 on a Product`,
        {
          priority: 'medium',
          description:
            'A site-wide or Organization-level rating does not make a product eligible for a rating snippet, and Google explicitly excludes self-controlled reviews on Organization/LocalBusiness. Attach aggregateRating to the Product on each product page.',
          code: `{
  "@type": "Product",
  "name": "Widget",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "reviewCount": "125"
  }
}`,
        },
      );
    }

    if (total > 0) {
      return this.pass(
        'Review or AggregateRating structured data found with a rating value and a non-zero count.',
        EXPECTED,
        `${total} usable rating/review record(s), ${productPagesWithRating.length} product page(s) with a Product-attached rating`,
      );
    }

    return this.fail(
      'Review content detected but no Review or AggregateRating schema carries a usable rating.',
      EXPECTED,
      'None',
      {
        priority: 'medium',
        description:
          'AI agents and search surfaces read ratingValue plus reviewCount from Review/AggregateRating markup. An empty aggregateRating object, a zero review count or an empty review array is not a rating — publish the real numbers.',
        code: `"aggregateRating": {
  "@type": "AggregateRating",
  "ratingValue": "4.8",
  "reviewCount": "150"
}`,
      },
    );
  }
}
