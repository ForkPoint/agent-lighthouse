import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { flattenJsonLd } from '../../parser';

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
    const objType = record['@type'];
    if (objType) {
      const typeArr = Array.isArray(objType) ? objType : [objType];
      for (const t of typeArr) {
        if (typeof t === 'string' && /^(?:aggregaterating|review)$/i.test(t)) {
          found.push(t);
        }
      }
    }

    // Nested review properties carried on a parent node (e.g. a Product with
    // `aggregateRating`/`review`/`reviewCount` but no dedicated Review node).
    if (record['aggregateRating']) found.push('aggregateRating');
    if (record['review']) found.push('review');
    if (record['reviewCount'] || record['ratingCount']) found.push('reviewCount');
  }

  return [...new Set(found)];
}

export class ReviewSignalsAudit extends Audit {
  static override meta: AuditMeta = {
    id: '10.8',
    category: 'generative-engine',
    title: 'Review/testimonial signals',
    failureTitle: 'Review/testimonial signals',
    description:
      'AI engines use reviews and testimonials as social proof signals when recommending products or services in generated answers.',
    scoreDisplayMode: 'binary',
    weight: 1.0,
    applicablePageTypes: ['homepage', 'product'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI generative engines use reviews and testimonials as social proof when recommending your product or service. Without machine-readable review signals, agents have no evidence to cite when users ask "is this product any good?".',
      fix: 'Add Review or AggregateRating JSON-LD schema, or use attributed <blockquote> elements with <cite> and <footer> for testimonials on your homepage and product pages.',
      code: '<blockquote cite="https://example.com/review">\n  <p>"Great product -- reduced our deployment time by 50%."</p>\n  <footer>- <cite>Jane Smith, CEO at Company</cite></footer>\n</blockquote>',
      effort: 'moderate',
      docsUrl: 'https://schema.org/Review',
      tags: ['trust', 'social-proof', 'schema', 'generative-engine'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    if (!page) {
      return this.fail(
        'No pages scanned.',
        'JSON-LD Review/AggregateRating or <blockquote> elements with attribution',
        'No pages scanned',
        {
          priority: 'medium',
          description:
            'AI engines use reviews and testimonials as social proof signals when recommending products or services in generated answers.',
          code: '<blockquote>\n  <p>"Great product!"</p>\n  <footer>- <cite>Jane Smith, CEO</cite></footer>\n</blockquote>',
        },
      );
    }

    const signals: string[] = [];

    for (const p of ctx.pages) {
      // Check JSON-LD for reviews (deep-flattened: catches nested
      // aggregateRating/review on Product nodes, not just @graph entries).
      const reviewNodes = findReviewNodes(p.jsonLd);
      if (reviewNodes.length > 0) {
        signals.push(`JSON-LD ${reviewNodes.join(', ')}`);
      }

      // Check for blockquotes with attribution (cite attr or <cite> child)
      const $ = p.$;
      const blockquotes = $('blockquote');
      if (blockquotes.length > 0) {
        let withAttribution = 0;
        blockquotes.each((_, el) => {
          const hasCite =
            $(el).attr('cite') || $(el).find('cite').length > 0 || $(el).find('footer').length > 0;
          if (hasCite) withAttribution++;
        });

        if (withAttribution > 0) {
          signals.push(`${withAttribution} attributed blockquote(s)`);
        } else {
          signals.push(`${blockquotes.length} blockquote(s) (no attribution)`);
        }
      }

      // DOM fallback: many stores render reviews via third-party widgets
      // (Yotpo, Okendo, Judge.me, Loox, Stamped...) whose schema is injected
      // client-side and so is absent from the server HTML JSON-LD. Detect the
      // widget markup or visible "N reviews" copy before failing.
      if (signals.length === 0) {
        const widget = $(
          '[class*="yotpo"],[class*="okendo"],[class*="jdgm"],[class*="judgeme"],[class*="loox"],[class*="stamped"],[class*="star-rating"]',
        );
        if (widget.length > 0) {
          signals.push('review widget markup');
        } else if (/\b\d[\d,]*\s+reviews?\b/i.test($('body').text())) {
          signals.push('"N reviews" text');
        }
      }
    }

    if (signals.length > 0) {
      return this.pass(
        `Review/testimonial signals found: ${signals.join('; ')}.`,
        'JSON-LD Review/AggregateRating or <blockquote> elements with attribution',
        signals.join('; '),
        page.url,
      );
    }

    return this.fail(
      'No review or testimonial signals found.',
      'JSON-LD Review/AggregateRating or <blockquote> elements with attribution',
      'Not found',
      {
        priority: 'medium',
        description:
          'AI generative engines use reviews and testimonials as social proof when recommending your product or service. Attributed blockquotes and Review/AggregateRating schema make social proof machine-readable, giving agents concrete evidence to cite when users ask "is X any good?".',
        code: '<blockquote cite="https://example.com/review">\n  <p>"Great product — reduced our deployment time by 50%."</p>\n  <footer>- <cite>Jane Smith, CEO at Company</cite></footer>\n</blockquote>',
      },
      page.url,
    );
  }
}
