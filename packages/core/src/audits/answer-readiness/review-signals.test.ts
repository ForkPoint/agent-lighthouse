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

  it('warns rather than passes on a review widget class fallback', () => {
    const page = mockPageContext(
      'https://example.com/products/widget',
      `<html><body><div class="yotpo-reviews-stars"></div></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('review widget markup');
    expect(result.message).toContain('not machine-readable');
  });

  it('warns rather than passes on visible "N reviews" text', () => {
    const page = mockPageContext(
      'https://example.com/products/widget',
      `<html><body><p>1,234 reviews from happy customers</p></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('warn');
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
    expect(result.message).toContain('attributed quotation');
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
    expect(result.message).toContain('attributed quotation');
  });

  it('passes via a <figure> quotation attributed with <figcaption>', () => {
    const page = mockPageContext(
      'https://example.com/',
      `<html><body>
        <figure>
          <blockquote><p>"It halved our onboarding time."</p></blockquote>
          <figcaption>Jane Smith, CTO at Acme</figcaption>
        </figure>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('attributed quotation');
  });

  it('covers @type array, nested review property and a typeless nested object', () => {
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

  // --- absorbed from blockquote-usage (v1 10.14) ---------------------------

  it('does not treat an unattributed pull-quote as a review signal', () => {
    // v1 10.8 passed here ("blockquote(s) (no attribution)") and v1 10.14
    // passed on the bare presence of the element. Neither is social proof.
    const page = mockPageContext(
      'https://example.com/',
      `<html><body>
        <blockquote><p>"A great quote with no attribution."</p></blockquote>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('unattributed');
  });

  it('ignores an empty blockquote entirely', () => {
    // A spacer or a lazy-loading placeholder passed v1 10.14 outright.
    const page = mockPageContext(
      'https://example.com/',
      `<html><body><blockquote></blockquote><p>Just a plain product description.</p></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
  });

  it('rejects a zero reviewCount as social proof', () => {
    const page = mockPageContext(
      'https://example.com/products/widget',
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Product","name":"Widget","aggregateRating":{"@type":"AggregateRating","ratingValue":"0","reviewCount":"0"}}
        </script>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
  });

  it('counts a non-zero reviewCount carried directly on the node', () => {
    const page = mockPageContext(
      'https://example.com/products/widget',
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Product","name":"Widget","ratingCount":42}
        </script>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
  });

  // A storefront that ships the review property with nothing in it has
  // published the shape of social proof, not the proof.
  it('rejects an empty review array as social proof', () => {
    const page = mockPageContext(
      'https://example.com/products/widget',
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Product","name":"Widget","review":[]}
        </script>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
  });

  // A ratingCount-only node was reported as `reviewCount`, naming a field the
  // page does not carry.
  it('names the count field that is actually present', () => {
    const page = mockPageContext(
      'https://example.com/products/widget',
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Product","name":"Widget","ratingCount":42}
        </script>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('ratingCount');
    expect(result.found).not.toContain('reviewCount');
  });

  it('reports the page the quotation was found on', () => {
    const plain = mockPageContext(
      'https://example.com/',
      `<html><body><p>Just a plain product description.</p></body></html>`,
    );
    const quoted = mockPageContext(
      'https://example.com/products/widget',
      `<html><body><blockquote cite="https://example.com/r"><p>"Superb."</p></blockquote></body></html>`,
      1,
    );
    const result = audit.audit(mockCheckContext([plain, quoted]));
    expect(result.status).toBe('pass');
    expect(result.pageUrl).toBe('https://example.com/products/widget');
  });

  it('prefers machine-readable review data over a weaker signal on an earlier page', () => {
    const widgetOnly = mockPageContext(
      'https://example.com/',
      `<html><body><div class="yotpo-reviews-stars"></div></body></html>`,
    );
    const structured = mockPageContext(
      'https://example.com/products/widget',
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Product","aggregateRating":{"@type":"AggregateRating","ratingValue":"4.5","reviewCount":"120"}}
        </script>
      </body></html>`,
      1,
    );
    const result = audit.audit(mockCheckContext([widgetOnly, structured]));
    expect(result.status).toBe('pass');
  });
});
