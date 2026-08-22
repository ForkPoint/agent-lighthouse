import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext, PageContext } from '../../check-context';
import { flattenJsonLd } from '../../parser';

/** Parse a schema.org count that may be serialized as a number or a string. */
function numericCount(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

/**
 * True when a node states, in a count field, that it has no reviews. A product
 * with `"reviewCount": "0"` is not social proof — v1 counted it as one, because
 * the string "0" is truthy.
 */
function statesZeroReviews(record: Record<string, unknown>): boolean {
  for (const key of ['reviewCount', 'ratingCount']) {
    const n = numericCount(record[key]);
    if (n !== null && n <= 0) return true;
  }
  return false;
}

/**
 * Scan deeply-flattened JSON-LD nodes for review evidence. Real Shopify themes
 * nest `aggregateRating`/`review` inside Product nodes (not just inside
 * @graph), so we rely on the shared `flattenJsonLd` deep recursion and then
 * match on both the @type and the property keys that carry review data.
 */
function findReviewNodes(jsonLd: object[]): string[] {
  const found: string[] = [];
  const nodes = flattenJsonLd(jsonLd) as Record<string, unknown>[];

  for (const record of nodes) {
    const zero = statesZeroReviews(record);
    const objType = record['@type'];
    if (objType) {
      const typeArr = Array.isArray(objType) ? objType : [objType];
      for (const t of typeArr) {
        if (typeof t === 'string' && /^(?:aggregaterating|review)$/i.test(t) && !zero) {
          found.push(t);
        }
      }
    }

    // Nested review properties carried on a parent node (e.g. a Product with
    // `aggregateRating`/`review`/`reviewCount` but no dedicated Review node).
    const aggregate = record['aggregateRating'];
    if (aggregate) {
      const aggregateZero =
        typeof aggregate === 'object' && aggregate !== null
          ? statesZeroReviews(aggregate as Record<string, unknown>)
          : false;
      if (!aggregateZero) found.push('aggregateRating');
    }
    if (record['review']) found.push('review');
    for (const key of ['reviewCount', 'ratingCount']) {
      const n = numericCount(record[key]);
      if (n !== null && n > 0) found.push('reviewCount');
    }
  }

  return [...new Set(found)];
}

/**
 * Quotations on a page, split by attribution. Absorbed from v1 10.14
 * `blockquote-usage`, which counted every `<blockquote>` including empty ones;
 * the GEO evidence it carried is about *attributed* quotations, so attribution
 * is what separates a testimonial from a decorative pull-quote here.
 */
function countQuotations(p: PageContext): { attributed: number; unattributed: number } {
  const $ = p.$;
  let attributed = 0;
  let unattributed = 0;

  $('blockquote').each((_, el) => {
    const quote = $(el);
    // An empty <blockquote> is a spacer or a lazy-loading placeholder, not a quote.
    if (!quote.text().trim()) return;

    const figcaption = quote.parent().is('figure') ? quote.parent().find('figcaption').length : 0;
    const hasAttribution =
      Boolean(quote.attr('cite')) ||
      quote.find('cite').length > 0 ||
      quote.find('footer').length > 0 ||
      figcaption > 0;

    if (hasAttribution) {
      attributed += 1;
    } else {
      unattributed += 1;
    }
  });

  return { attributed, unattributed };
}

export class ReviewSignalsAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'answer-readiness/review-signals',
    category: 'answer-readiness',
    title: 'Review/testimonial signals',
    failureTitle: 'Review/testimonial signals',
    description:
      'Google parses schema.org Review/AggregateRating to render review rich results, and attributed quotations are the best-measured lever in the GEO literature. This audit passes on machine-readable social proof — review structured data, or quotations carried in <blockquote> with attribution — and warns when review UI is on the page but nothing machine-readable is behind it.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier: 'docs/evidence/audits/answer-readiness/review-signals.md',
    applicablePageTypes: ['homepage', 'product'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI generative engines use reviews and testimonials as social proof when recommending your product or service. Without machine-readable review signals, agents have no evidence to cite when users ask "is this product any good?".',
      fix: 'Add Review or AggregateRating JSON-LD schema, and attribute testimonial quotes with <blockquote> plus <cite>, <footer> or a <figcaption> — an unattributed pull-quote is decoration, not social proof.',
      code: '<blockquote cite="https://example.com/review">\n  <p>"Great product -- reduced our deployment time by 50%."</p>\n  <footer>- <cite>Jane Smith, CEO at Company</cite></footer>\n</blockquote>',
      effort: 'moderate',
      docsUrl: 'https://schema.org/Review',
      tags: ['trust', 'social-proof', 'schema', 'generative-engine'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    const expected =
      'JSON-LD Review/AggregateRating, or <blockquote> quotations with attribution';

    if (!page) {
      return this.fail(
        'No pages scanned.',
        expected,
        'No pages scanned',
        {
          priority: 'medium',
          description:
            'AI engines use reviews and testimonials as social proof signals when recommending products or services in generated answers.',
          code: '<blockquote>\n  <p>"Great product!"</p>\n  <footer>- <cite>Jane Smith, CEO</cite></footer>\n</blockquote>',
        },
      );
    }

    // Machine-readable social proof: what an agent consumer can actually read.
    const strong: string[] = [];
    let strongUrl: string | undefined;
    // Review UI with nothing machine-readable behind it, plus unattributed quotes.
    const weak: string[] = [];
    let weakUrl: string | undefined;

    const noteStrong = (label: string, url: string) => {
      strong.push(label);
      strongUrl ??= url;
    };
    const noteWeak = (label: string, url: string) => {
      weak.push(label);
      weakUrl ??= url;
    };

    for (const p of ctx.pages) {
      const reviewNodes = findReviewNodes(p.jsonLd);
      if (reviewNodes.length > 0) noteStrong(`JSON-LD ${reviewNodes.join(', ')}`, p.url);

      const quotes = countQuotations(p);
      if (quotes.attributed > 0) {
        noteStrong(`${quotes.attributed} attributed quotation(s)`, p.url);
      } else if (quotes.unattributed > 0) {
        noteWeak(`${quotes.unattributed} unattributed blockquote(s)`, p.url);
      }

      // Many stores render reviews through third-party widgets (Yotpo, Okendo,
      // Judge.me, Loox, Stamped...) whose schema is injected client-side. The
      // reviews are real, but nothing on the fetched page is machine-readable.
      const widget = p.$(
        '[class*="yotpo"],[class*="okendo"],[class*="jdgm"],[class*="judgeme"],[class*="loox"],[class*="stamped"],[class*="star-rating"]',
      );
      if (widget.length > 0) {
        noteWeak('review widget markup', p.url);
      } else if (/\b\d[\d,]*\s+reviews?\b/i.test(p.$('body').text())) {
        noteWeak('"N reviews" text', p.url);
      }
    }

    if (strong.length > 0) {
      return this.pass(
        `Machine-readable review/testimonial signals found: ${strong.join('; ')}.`,
        expected,
        strong.join('; '),
        strongUrl,
      );
    }

    if (weak.length > 0) {
      return this.warn(
        `Review signals found but not machine-readable: ${weak.join('; ')}.`,
        expected,
        weak.join('; '),
        {
          priority: 'medium',
          description:
            'The page shows review or quotation content, but nothing an agent can read: client-injected widget markup, a visible review count, or a quote with no attribution. Add Review/AggregateRating structured data server-side, and attribute testimonial quotes with <cite>, <footer> or a <figcaption>.',
          code: '<script type="application/ld+json">\n{"@context":"https://schema.org","@type":"Product","aggregateRating":{"@type":"AggregateRating","ratingValue":"4.5","reviewCount":"120"}}\n</script>',
        },
        weakUrl,
      );
    }

    return this.fail(
      'No review or testimonial signals found.',
      expected,
      'Not found',
      {
        priority: 'medium',
        description:
          'AI generative engines use reviews and testimonials as social proof when recommending your product or service. Attributed quotations and Review/AggregateRating schema make social proof machine-readable, giving agents concrete evidence to cite when users ask "is X any good?".',
        code: '<blockquote cite="https://example.com/review">\n  <p>"Great product — reduced our deployment time by 50%."</p>\n  <footer>- <cite>Jane Smith, CEO at Company</cite></footer>\n</blockquote>',
      },
      page.url,
    );
  }
}
