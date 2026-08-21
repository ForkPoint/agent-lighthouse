import { describe, it, expect } from 'vitest';
import { ReviewSignalsAudit } from './review-signals';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('ReviewSignalsAudit', () => {
  const audit = new ReviewSignalsAudit();

  it('passes via nested aggregateRating in JSON-LD', () => {
    const page = mockPageContext(
      'https://example.com/products/widget',
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Product","name":"Widget","aggregateRating":{"@type":"AggregateRating","ratingValue":"4.5","reviewCount":"120"}}
        </script>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('JSON-LD');
  });

  it('passes via a top-level JSON-LD array of Product nodes', () => {
    const page = mockPageContext(
      'https://example.com/products/widget',
      `<html><body>
        <script type="application/ld+json">
        [{"@context":"https://schema.org","@type":"Product","name":"Widget","aggregateRating":{"@type":"AggregateRating","ratingValue":"4.0"}}]
        </script>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('JSON-LD');
  });

  it('passes via a review widget class fallback', () => {
    const page = mockPageContext(
      'https://example.com/products/widget',
      `<html><body><div class="yotpo-reviews-stars"></div></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('review widget markup');
  });

  it('passes via visible "N reviews" text fallback', () => {
    const page = mockPageContext(
      'https://example.com/products/widget',
      `<html><body><p>1,234 reviews from happy customers</p></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('reviews');
  });

  it('fails when no review signals are present', () => {
    const page = mockPageContext(
      'https://example.com/products/widget',
      `<html><body><p>Just a plain product description.</p></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No review or testimonial signals found');
  });

  it('fails when no pages scanned', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No pages scanned');
  });

  it('passes via attributed blockquote with a <cite> child element', () => {
    const page = mockPageContext(
      'https://example.com/',
      `<html><body>
        <blockquote>
          <p>"Excellent product!"</p>
          <footer>- <cite>Jane Smith, CEO at Acme Corp</cite></footer>
        </blockquote>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('attributed blockquote');
  });

  it('passes via attributed blockquote with a cite attribute', () => {
    const page = mockPageContext(
      'https://example.com/',
      `<html><body>
        <blockquote cite="https://example.com/review">
          <p>"Outstanding results — highly recommended."</p>
        </blockquote>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('attributed blockquote');
  });

  it('passes via blockquote without attribution (records unattributed count)', () => {
    const page = mockPageContext(
      'https://example.com/',
      `<html><body>
        <blockquote><p>"A great quote with no attribution."</p></blockquote>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('blockquote(s) (no attribution)');
  });

  it('covers line 18 false (@type absent), line 19 array @type, and line 30 review property', () => {
    // Node with @type:["Review"] covers Array.isArray true (line 19).
    // Product node with "review" property covers line 30.
    // "metadata" nested object without @type covers line 18 false branch.
    const page = mockPageContext(
      'https://example.com/products/widget',
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Product","name":"Widget",
         "metadata":{"source":"internal"},
         "review":{"@type":["Review"],"reviewBody":"Excellent product!"}}
        </script>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('JSON-LD');
  });
});
