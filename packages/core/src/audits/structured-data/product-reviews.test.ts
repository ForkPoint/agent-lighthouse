import { describe, it, expect } from 'vitest';
import { ProductReviewsAudit } from './product-reviews';
import { mockPageContext, mockCheckContext } from '../../__tests__/test-utils';

const ld = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
const productPage = (head: string) =>
  mockPageContext('https://example.com/products/widget', `<html><head>${head}</head><body></body></html>`, 1);

describe('ProductReviewsAudit', () => {
  const audit = new ProductReviewsAudit();

  it('passes when a Product has a nested aggregateRating', () => {
    const ctx = mockCheckContext([
      productPage(
        ld({
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: 'Widget',
          aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.8', reviewCount: '125' },
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('AggregateRating');
  });

  it('passes for a standalone AggregateRating type', () => {
    const ctx = mockCheckContext([
      productPage(
        ld({ '@context': 'https://schema.org', '@type': 'AggregateRating', ratingValue: '5', reviewCount: '3' }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('detects a Product rating in a top-level `[{...}]` array (Shopify-style)', () => {
    const ctx = mockCheckContext([
      productPage(
        ld([
          {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: 'Widget',
            aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.8', reviewCount: '125' },
          },
        ]),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('warns when there are no ratings in structured data', () => {
    const ctx = mockCheckContext([
      productPage(ld({ '@context': 'https://schema.org', '@type': 'Product', name: 'Widget' })),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No product ratings found');
  });
});
