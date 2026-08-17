import { describe, it, expect } from 'vitest';
import { ReviewSchemaAudit } from './review-schema';
import { mockPageContext, mockCheckContext } from '../../__tests__/test-utils';

const ld = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
const page = (body: string, head = '') =>
  mockPageContext('https://example.com/products/widget', `<html><head>${head}</head><body>${body}</body></html>`, 1);

describe('ReviewSchemaAudit', () => {
  const audit = new ReviewSchemaAudit();

  it('warns (low) when there is no testimonial/review content', () => {
    const ctx = mockCheckContext([page('<h1>Welcome to our shop</h1>')]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No testimonial or review content');
  });

  it('passes when review content co-occurs with a nested aggregateRating', () => {
    const ctx = mockCheckContext([
      page(
        '<h2>Customer reviews</h2>',
        ld({
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: 'Widget',
          aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.8', reviewCount: '150' },
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('Review or AggregateRating');
  });

  it('detects a standalone AggregateRating nested inside @graph', () => {
    const ctx = mockCheckContext([
      page(
        '<h2>Ratings</h2>',
        ld({
          '@context': 'https://schema.org',
          '@graph': [{ '@type': 'AggregateRating', ratingValue: '5', reviewCount: '3' }],
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('fails when review content exists but no review schema', () => {
    const ctx = mockCheckContext([
      page(
        '<h2>Customer reviews</h2>',
        ld({ '@context': 'https://schema.org', '@type': 'Organization', name: 'Acme' }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('no Review or AggregateRating schema found');
  });

  it('detects a standalone Review schema with array @type (Array.isArray branch)', () => {
    // @type as an array triggers the Array.isArray branch in matchesAnyType
    const ctx = mockCheckContext([
      page(
        '<h2>Customer reviews</h2>',
        ld({
          '@context': 'https://schema.org',
          '@type': ['Review', 'UserReview'],
          author: { '@type': 'Person', name: 'Alice' },
          reviewBody: 'Great product!',
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });
});
