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
 * Page text with script/style noise stripped, collapsed to single spaces.
 *
 * The "N reviews" test ran against raw `body.text()`, so an inline JSON payload
 * carrying `"1234 reviews"` counted as visible review UI. Sibling audits in
 * this category already clone-and-strip; this one now does too.
 */
function readableText(page: PageContext): string {
  const body = page.$('body').clone();
  body.find('script, style, noscript, template').remove();
  return body.text().replace(/\s+/g, ' ').trim();
}

/**
 * True when a rating node carries an actual rating rather than the vocabulary
 * for one. Google prohibits markup that is not "sourced directly from users",
 * so the presence of the property is not itself evidence of social proof.
 */
function hasRatingSubstance(record: Record<string, unknown>): boolean {
  const counts = ['reviewCount', 'ratingCount']
    .map((key) => numericCount(record[key]))
    .filter((n): n is number => n !== null);
  if (counts.some((n) => n > 0)) return true;
  const rating = numericCount(record['ratingValue']);
  // A ratingValue of 0 with no positive count states the same nothing that
  // `statesZeroReviews` already rejects on the count fields.
  return rating !== null && rating > 0;
}

/** True when a `Review` node carries a review rather than the shape of one. */
function hasReviewSubstance(value: unknown): boolean {
  if (typeof value === 'string') return value.trim() !== '';
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;

  const body = record['reviewBody'];
  if (typeof body === 'string' && body.trim() !== '') return true;

  const author = record['author'];
  if (typeof author === 'string' && author.trim() !== '') return true;
  if (typeof author === 'object' && author !== null) {
    const named = author as Record<string, unknown>;
    for (const key of ['name', '@id']) {
      const field = named[key];
      if (typeof field === 'string' && field.trim() !== '') return true;
    }
  }

  const rating = record['reviewRating'];
  if (typeof rating === 'object' && rating !== null) {
    return numericCount((rating as Record<string, unknown>)['ratingValue']) !== null;
  }
  return false;
}

/**
 * Scan deeply-flattened JSON-LD nodes for review evidence. Real Shopify themes
 * nest `aggregateRating`/`review` inside Product nodes (not just inside
 * @graph), so we rely on the shared `flattenJsonLd` deep recursion and then
 * match on both the @type and the property keys that carry review data.
 *
 * Exported so `answer-readiness/trust-signals` can defer its social-proof
 * factor to this audit on pages that already carry machine-readable review
 * data — the two audits must not score the same page fact twice.
 */
export function findReviewNodes(jsonLd: object[]): string[] {
  const found: string[] = [];
  const nodes = flattenJsonLd(jsonLd) as Record<string, unknown>[];

  for (const record of nodes) {
    const zero = statesZeroReviews(record);
    const objType = record['@type'];
    if (objType) {
      const typeArr = Array.isArray(objType) ? objType : [objType];
      for (const t of typeArr) {
        if (typeof t !== 'string' || zero) continue;
        if (/^aggregaterating$/i.test(t) && hasRatingSubstance(record)) found.push(t);
        if (/^review$/i.test(t) && hasReviewSubstance(record)) found.push(t);
      }
    }

    // Nested review properties carried on a parent node (e.g. a Product with
    // `aggregateRating`/`review`/`reviewCount` but no dedicated Review node).
    // `"aggregateRating": true` and `"aggregateRating": {}` are the shape of a
    // rating without a rating. Only an object carrying a value counts.
    const aggregate = record['aggregateRating'];
    if (typeof aggregate === 'object' && aggregate !== null) {
      const nested = aggregate as Record<string, unknown>;
      if (!statesZeroReviews(nested) && hasRatingSubstance(nested)) found.push('aggregateRating');
    }
    // `"review": []` is the shape of social proof without the proof. A
    // storefront that ships the property empty has published nothing, and one
    // that ships `[{"@type":"Review"}]` has published no more.
    const review = record['review'];
    const reviews = Array.isArray(review) ? review : review === undefined ? [] : [review];
    if (reviews.some(hasReviewSubstance)) found.push('review');
    for (const key of ['reviewCount', 'ratingCount']) {
      const n = numericCount(record[key]);
      // Label by the key that was actually present: a ratingCount-only node
      // used to be reported as carrying a reviewCount it does not have.
      if (n !== null && n > 0) found.push(key);
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

  /**
   * A `cite` attribute is attribution only where it names a document.
   *
   * Relative references count — `cite="/press/review"` is a real citation — but
   * a URL reference carries no unescaped whitespace, so `cite="see our press
   * page"` is prose in a URL slot and names nobody. Resolving it against the
   * page would otherwise turn any sentence into a valid URL.
   */
  const citesADocument = (value: string | undefined): boolean => {
    const reference = value?.trim();
    if (!reference || /\s/.test(reference)) return false;
    try {
      const { protocol } = new URL(reference, p.url);
      return protocol === 'http:' || protocol === 'https:';
    } catch {
      return false;
    }
  };

  /** An empty `<cite>` or `<footer>` names nobody. */
  const namesSomeone = (selector: string, within: ReturnType<typeof $>): boolean =>
    within
      .find(selector)
      .toArray()
      .some((el) => $(el).text().trim() !== '');

  $('blockquote').each((_, el) => {
    const quote = $(el);
    // An empty <blockquote> is a spacer or a lazy-loading placeholder, not a quote.
    if (!quote.text().trim()) return;

    const figure = quote.parent().is('figure') ? quote.parent() : undefined;
    const hasAttribution =
      citesADocument(quote.attr('cite')) ||
      namesSomeone('cite', quote) ||
      namesSomeone('footer', quote) ||
      (figure !== undefined && namesSomeone('figcaption', figure));

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
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
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
    const expected =
      'On a homepage or product page: JSON-LD Review/AggregateRating carrying a rating or a non-zero review count, or a <blockquote> quotation with attribution';

    if (ctx.pages.length === 0) {
      return this.notApplicable('No pages were scanned.', expected, 'No pages scanned');
    }

    // The review-vocabulary evidence is commerce-scoped: Google's review rich
    // results are entity markup and OpenAI's review_count/star_rating are
    // product-feed fields. A blog post's star-rating div or an inline JSON
    // payload reading "1,234 reviews" is not evidence about either. The
    // quotation branch is deliberately not scoped this way — its GEO
    // measurement is about generative-answer citation on content generally, so
    // confining it to commerce pages would narrow past its own evidence.
    const commerce = ctx.pages.filter(
      (p) => p.pageType === 'homepage' || p.pageType === 'product',
    );

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

    // Reported, never scored: nothing in any source supports counting an
    // unattributed quotation as a review signal.
    let unattributed = 0;

    for (const p of ctx.pages) {
      const quotes = countQuotations(p);
      if (quotes.attributed > 0) {
        noteStrong(`${quotes.attributed} attributed quotation(s)`, p.url);
      }
      unattributed += quotes.unattributed;
    }

    for (const p of commerce) {
      const reviewNodes = findReviewNodes(p.jsonLd);
      if (reviewNodes.length > 0) noteStrong(`JSON-LD ${reviewNodes.join(', ')}`, p.url);

      // Many stores render reviews through third-party widgets (Yotpo, Okendo,
      // Judge.me, Loox, Stamped...) whose schema is injected client-side. The
      // reviews are real, but nothing on the fetched page is machine-readable.
      // An empty placeholder is not review UI, so the element must carry
      // something.
      const widget = p
        .$(
          '[class*="yotpo"],[class*="okendo"],[class*="jdgm"],[class*="judgeme"],[class*="loox"],[class*="stamped"],[class*="star-rating"]',
        )
        .toArray()
        .filter((el) => p.$(el).text().trim() !== '' || p.$(el).children().length > 0);
      if (widget.length > 0) {
        noteWeak('review widget markup', p.url);
      } else if (/\b\d[\d,]*\s+reviews?\b/i.test(readableText(p))) {
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

    const pullQuotes =
      unattributed > 0 ? `${unattributed} unattributed pull-quote(s)` : undefined;

    if (weak.length > 0) {
      return this.warn(
        `Review signals found but not machine-readable: ${weak.join('; ')}.`,
        expected,
        [...weak, pullQuotes].filter(Boolean).join('; '),
        {
          priority: 'medium',
          description:
            'The page shows review UI, but nothing an agent can read: client-injected widget markup or a visible review count. Add Review/AggregateRating structured data server-side, and attribute testimonial quotes with <cite>, <footer> or a <figcaption>.',
          code: '<script type="application/ld+json">\n{"@context":"https://schema.org","@type":"Product","aggregateRating":{"@type":"AggregateRating","ratingValue":"4.5","reviewCount":"120"}}\n</script>',
        },
        weakUrl,
      );
    }

    return this.fail(
      pullQuotes
        ? 'No review or testimonial signals found. Attribution is what separates a testimonial from decoration.'
        : 'No review or testimonial signals found.',
      expected,
      pullQuotes ? `${pullQuotes}, no attribution` : 'Not found',
      {
        priority: 'medium',
        description:
          'AI generative engines use reviews and testimonials as social proof when recommending your product or service. Attributed quotations and Review/AggregateRating schema make social proof machine-readable, giving agents concrete evidence to cite when users ask "is X any good?".',
        code: '<blockquote cite="https://example.com/review">\n  <p>"Great product — reduced our deployment time by 50%."</p>\n  <footer>- <cite>Jane Smith, CEO at Company</cite></footer>\n</blockquote>',
      },
      (commerce[0] ?? ctx.pages[0])!.url,
    );
  }
}
