import { describe, it, expect } from 'vitest';
import { OfferSchemaAudit } from './offer-schema';
import { mockPageContext, mockCheckContext } from '../../__tests__/test-utils';

const ld = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
// /products/* URLs are classified as product pages by detectPageType.
const productPage = (head: string, url = 'https://example.com/products/widget') =>
  mockPageContext(url, `<html><head>${head}</head><body></body></html>`, 1);
const homePage = (head: string) =>
  mockPageContext('https://example.com/', `<html><head>${head}</head><body></body></html>`, 0);

const productWithOffer = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Widget',
  offers: { '@type': 'Offer', price: '99.00', priceCurrency: 'USD' },
};

describe('OfferSchemaAudit', () => {
  const audit = new OfferSchemaAudit();

  it('is not applicable when there are no product pages', () => {
    const ctx = mockCheckContext([
      homePage(ld({ '@context': 'https://schema.org', '@type': 'Organization', name: 'Acme' })),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('na');
    expect(result.message).toContain('No product pages');
  });

  it('passes when a product page has an offers prop with price + priceCurrency', () => {
    const ctx = mockCheckContext([productPage(ld(productWithOffer))]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('detects an array-wrapped Product with offers', () => {
    const ctx = mockCheckContext([productPage(ld([productWithOffer]))]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('fails when a product page has no Offer schema', () => {
    const ctx = mockCheckContext([
      productPage(ld({ '@context': 'https://schema.org', '@type': 'Product', name: 'Widget' })),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No Offer schema found');
  });

  it('warns when only some product pages have Offer schema', () => {
    const ctx = mockCheckContext([
      productPage(ld(productWithOffer), 'https://example.com/products/a'),
      productPage(
        ld({ '@context': 'https://schema.org', '@type': 'Product', name: 'B' }),
        'https://example.com/products/b',
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.found).toBe('1/2 product pages with Offer schema');
  });

  it('detects a standalone Offer schema with array @type (Array.isArray branch)', () => {
    // @type as an array triggers the Array.isArray branch in matchesAnyType
    const ctx = mockCheckContext([
      productPage(
        ld({
          '@context': 'https://schema.org',
          '@type': ['Offer', 'AggregateOffer'],
          price: '49.00',
          priceCurrency: 'USD',
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('handles a typeless schema alongside an Offer (return false branch)', () => {
    // A schema without @type forces matchesAnyType to reach `return false`.
    // The valid Offer still drives the product page to pass.
    const ctx = mockCheckContext([
      productPage(
        ld([
          { name: 'Untyped object' },
          {
            '@context': 'https://schema.org',
            '@type': 'Offer',
            price: '29.00',
            priceCurrency: 'EUR',
          },
        ]),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('detects an Offer when offers property is an array (Array.isArray offers branch)', () => {
    // `offers` as an array triggers Array.isArray(offer) true branch in hasOfferProp
    const ctx = mockCheckContext([
      productPage(
        ld({
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: 'Multi-variant Widget',
          offers: [
            { '@type': 'Offer', price: '49.00', priceCurrency: 'USD' },
            { '@type': 'Offer', price: '79.00', priceCurrency: 'USD' },
          ],
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });
});
