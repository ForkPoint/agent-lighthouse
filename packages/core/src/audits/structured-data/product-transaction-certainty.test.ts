import { describe, it, expect } from 'vitest';
import { ProductTransactionCertaintyAudit } from './product-transaction-certainty';
import { mockPageContext, mockCheckContext } from '../../__tests__/test-utils';

const ld = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;

describe('ProductTransactionCertaintyAudit', () => {
  const audit = new ProductTransactionCertaintyAudit();

  it('is not applicable when no Product schema exists', () => {
    const html = `<html><head>${ld({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Acme',
    })}</head><body></body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html, 0)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('na');
  });

  it('fails when Product relies on name and price alone', () => {
    const html = `<html><head>${ld({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Shoe',
      offers: {
        '@type': 'Offer',
        price: '49.99',
        priceCurrency: 'USD',
      },
    })}</head><body></body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/products/shoe', html, 1)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('1/4');
    expect(result.message).toContain('offers.availability');
  });

  it('fails when Product has no Offer block at all', () => {
    const html = `<html><head>${ld({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Shoe',
    })}</head><body></body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/products/shoe', html, 1)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('no Offer block');
  });

  it('warns when 2-3 certainty signals are present', () => {
    const html = `<html><head>${ld({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Shoe',
      offers: {
        '@type': 'Offer',
        price: '49.99',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      },
    })}</head><body></body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/products/shoe', html, 1)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.found).toContain('2/4');
    expect(result.found).toContain('priceValidUntil');
  });

  it('passes when all 4 signals are present on the Offer', () => {
    const html = `<html><head>${ld({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Shoe',
      offers: {
        '@type': 'Offer',
        price: '49.99',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        priceValidUntil: '2026-12-31',
        hasMerchantReturnPolicy: {
          '@type': 'MerchantReturnPolicy',
          applicableCountry: 'US',
          merchantReturnDays: 30,
        },
      },
    })}</head><body></body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/products/shoe', html, 1)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.found).toContain('4/4');
  });

  it('passes when hasMerchantReturnPolicy lives on the Product, and finds Product inside @graph', () => {
    const html = `<html><head>${ld({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Product',
          name: 'Shoe',
          hasMerchantReturnPolicy: {
            '@type': 'MerchantReturnPolicy',
            applicableCountry: 'US',
          },
          offers: {
            '@type': 'Offer',
            price: '49.99',
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
            priceValidUntil: '2026-12-31',
          },
        },
      ],
    })}</head><body></body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/products/shoe', html, 1)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });
});
