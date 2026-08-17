import { describe, it, expect } from 'vitest';
import { ProductIdentifiersAudit } from './product-identifiers';
import { mockPageContext, mockCheckContext } from '../../__tests__/test-utils';

const ld = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
const productPage = (head: string) =>
  mockPageContext('https://example.com/products/widget', `<html><head>${head}</head><body></body></html>`, 1);

describe('ProductIdentifiersAudit', () => {
  const audit = new ProductIdentifiersAudit();

  it('fails when no Product schema is present', () => {
    const ctx = mockCheckContext([
      productPage(ld({ '@context': 'https://schema.org', '@type': 'Organization', name: 'Acme' })),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No Product schema found');
  });

  it('passes when a Product has a SKU', () => {
    const ctx = mockCheckContext([
      productPage(
        ld({ '@context': 'https://schema.org', '@type': 'Product', name: 'Widget', sku: 'SKU-1' }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('sku');
  });

  it('detects an array-wrapped Product (top-level `[{...}]`)', () => {
    const ctx = mockCheckContext([
      productPage(
        ld([
          { '@context': 'https://schema.org', '@type': 'Product', name: 'Widget', gtin13: '1234567890123' },
        ]),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('detects identifiers on a Product nested inside @graph', () => {
    const ctx = mockCheckContext([
      productPage(
        ld({
          '@context': 'https://schema.org',
          '@graph': [{ '@type': 'Product', name: 'Widget', mpn: 'MPN-1' }],
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('fails when a Product has no identifiers', () => {
    const ctx = mockCheckContext([
      productPage(ld({ '@context': 'https://schema.org', '@type': 'Product', name: 'Widget' })),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No unique product identifiers');
  });

  it('detects a Product with array @type and a SKU (Array.isArray branch)', () => {
    // @type as an array triggers the Array.isArray branch in matchesAnyType
    const ctx = mockCheckContext([
      productPage(
        ld({
          '@context': 'https://schema.org',
          '@type': ['Product', 'IndividualProduct'],
          name: 'Widget',
          sku: 'SKU-ARRAY',
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('sku');
  });
});
