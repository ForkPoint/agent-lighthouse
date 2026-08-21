import { describe, it, expect } from 'vitest';
import { ProductDetailsAudit } from './advanced-product-details';
import { mockPageContext, mockCheckContext } from '../../__tests__/test-utils';

const ld = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
const productPage = (head: string) =>
  mockPageContext('https://example.com/products/widget', `<html><head>${head}</head><body></body></html>`, 1);

describe('ProductDetailsAudit', () => {
  const audit = new ProductDetailsAudit();

  it('fails when no Product schema is present', () => {
    const ctx = mockCheckContext([
      productPage(ld({ '@context': 'https://schema.org', '@type': 'Organization', name: 'Acme' })),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No Product schema found');
  });

  it('passes with brand, category, and availability (availability via offers)', () => {
    const ctx = mockCheckContext([
      productPage(
        ld({
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: 'Widget',
          brand: { '@type': 'Brand', name: 'Acme' },
          category: 'Electronics',
          offers: { '@type': 'Offer', availability: 'https://schema.org/InStock' },
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('Found brand, category, and availability');
  });

  it('detects a Product in a top-level `[{...}]` array (Shopify-style)', () => {
    const ctx = mockCheckContext([
      productPage(
        ld([
          {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: 'Widget',
            brand: { '@type': 'Brand', name: 'Acme' },
            category: 'Electronics',
            offers: { '@type': 'Offer', availability: 'https://schema.org/InStock' },
          },
        ]),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('warns when some details are missing (only brand present)', () => {
    const ctx = mockCheckContext([
      productPage(
        ld({
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: 'Widget',
          brand: { '@type': 'Brand', name: 'Acme' },
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('category, availability');
  });

  it('fails when brand, category, and availability are all missing', () => {
    const ctx = mockCheckContext([
      productPage(ld({ '@context': 'https://schema.org', '@type': 'Product', name: 'Widget' })),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('Missing critical product details');
  });

  it('detects a Product with array @type (Array.isArray branch in matchesAnyType)', () => {
    const ctx = mockCheckContext([
      productPage(
        ld({
          '@context': 'https://schema.org',
          '@type': ['Product', 'IndividualProduct'],
          name: 'Widget',
          brand: { '@type': 'Brand', name: 'Acme' },
          category: 'Electronics',
          availability: 'https://schema.org/InStock',
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('handles a typeless schema alongside a Product (return false branch)', () => {
    // A schema without @type forces matchesAnyType to reach `return false`.
    // The valid Product schema still drives the result.
    const ctx = mockCheckContext([
      productPage(
        ld([
          { name: 'Untyped metadata' },
          {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: 'Widget',
            brand: { '@type': 'Brand', name: 'Acme' },
            category: 'Tools',
            availability: 'https://schema.org/InStock',
          },
        ]),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('detects availability from an array of offers (Array.isArray offers branch)', () => {
    // `offers` as an array triggers Array.isArray(first['offers']) true branch
    const ctx = mockCheckContext([
      productPage(
        ld({
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: 'Widget',
          brand: { '@type': 'Brand', name: 'Acme' },
          category: 'Electronics',
          offers: [
            { '@type': 'Offer', availability: 'https://schema.org/InStock' },
            { '@type': 'Offer', availability: 'https://schema.org/PreOrder' },
          ],
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });
});
