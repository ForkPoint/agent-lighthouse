import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import {
  parseAmount,
  productRegion,
  priceCandidates,
  offerNodes,
  platformFingerprint,
} from './commerce';
import { mockPageContext } from '../__tests__/test-utils';
import { extractJsonLd } from '../parser';

describe('commerce gatherer', () => {
  describe('parseAmount', () => {
    it('reads both separator conventions', () => {
      expect(parseAmount('$1,234.56')).toBeCloseTo(1234.56);
      expect(parseAmount('1.234,56 €')).toBeCloseTo(1234.56);
      expect(parseAmount('49,00')).toBeCloseTo(49);
      expect(parseAmount('49.00')).toBeCloseTo(49);
      expect(parseAmount('1 299,00')).toBeCloseTo(1299);
      expect(parseAmount('1 299,00')).toBeCloseTo(1299);
      expect(parseAmount('2,500')).toBeCloseTo(2500);
    });

    it('returns undefined when there is no number', () => {
      expect(parseAmount('Sold out')).toBeUndefined();
    });
  });

  describe('productRegion', () => {
    it('returns the nearest ancestor holding both the h1 and the price', () => {
      const $ = cheerio.load(`
        <body>
          <main>
            <div id="pdp"><h1>Blue shirt</h1><span class="price">$49.00</span></div>
            <aside id="related"><h2>Also bought</h2><span class="price">$99.00</span></aside>
          </main>
        </body>`);
      const region = productRegion($);
      expect(region.attr('id')).toBe('pdp');
      expect(region.text()).not.toContain('99.00');
    });

    it('falls back to main, then body', () => {
      const withMain = cheerio.load('<body><main><p>No product here.</p></main></body>');
      expect(productRegion(withMain).is('main')).toBe(true);
      const bare = cheerio.load('<body><p>Nothing.</p></body>');
      expect(productRegion(bare).is('body')).toBe(true);
    });
  });

  describe('priceCandidates', () => {
    it('reads amounts on either side of the currency', () => {
      const $ = cheerio.load('<div id="r"><span>$49.00</span><span>1.234,56 EUR</span></div>');
      const usd = priceCandidates($, $('#r'), 'USD');
      expect(usd.map((c) => c.value)).toContain(49);
      const eur = priceCandidates($, $('#r'), 'EUR');
      expect(eur.map((c) => c.value)).toContain(1234.56);
    });

    it('does not read a bare number as a price', () => {
      const $ = cheerio.load('<div id="r"><span>4.7 stars</span><span>128 reviews</span></div>');
      expect(priceCandidates($, $('#r'), 'USD')).toHaveLength(0);
    });

    it('marks a strikethrough amount as struck', () => {
      const $ = cheerio.load('<div id="r"><del>$99.00</del><span class="now">$49.00</span></div>');
      const found = priceCandidates($, $('#r'), 'USD');
      expect(found.find((c) => c.value === 99)?.struck).toBe(true);
      expect(found.find((c) => c.value === 49)?.struck).toBe(false);
    });

    it('marks a compare-at wrapper and everything inside it', () => {
      const $ = cheerio.load('<div id="r"><div class="compare-at"><span>$99.00</span></div></div>');
      expect(priceCandidates($, $('#r'), 'USD')[0]?.struck).toBe(true);
    });
  });

  describe('offerNodes', () => {
    it('reads price, currency, availability and identifiers', () => {
      const $ = cheerio.load(`<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Product',
        sku: 'SHIRT-BLUE-M',
        offers: {
          '@type': 'Offer',
          price: '49.00',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          priceValidUntil: '2026-12-31',
          sku: 'SHIRT-BLUE-M',
        },
      })}</script>`);
      const offers = offerNodes(extractJsonLd($));
      expect(offers).toHaveLength(1);
      expect(offers[0]?.price).toBeCloseTo(49);
      expect(offers[0]?.priceCurrency).toBe('USD');
      expect(offers[0]?.availability).toContain('InStock');
      expect(offers[0]?.sku).toBe('SHIRT-BLUE-M');
    });

    it('records an AggregateOffer that carries only a range', () => {
      const $ = cheerio.load(`<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Product',
        offers: { '@type': 'AggregateOffer', lowPrice: '29.00', highPrice: '59.00', priceCurrency: 'USD' },
      })}</script>`);
      const offers = offerNodes(extractJsonLd($));
      expect(offers[0]?.aggregateRange).toEqual({ low: 29, high: 59 });
      expect(offers[0]?.price).toBeUndefined();
    });

    it('returns nothing for a page with no offer', () => {
      const $ = cheerio.load('<html><body><p>An article.</p></body></html>');
      expect(offerNodes(extractJsonLd($))).toHaveLength(0);
    });
  });

  describe('platformFingerprint', () => {
    it('names each platform from its markup', () => {
      const cases: Array<[string, string]> = [
        ['<script src="https://cdn.shopify.com/x.js"></script>', 'shopify'],
        ['<link href="/wp-content/plugins/woocommerce/style.css">', 'woocommerce'],
        ['<script src="https://cdn11.bigcommerce.com/x.js"></script>', 'bigcommerce'],
        ['<script src="/static/version1234/frontend/Magento_Theme/x.js"></script>', 'magento'],
      ];
      for (const [markup, expected] of cases) {
        const page = mockPageContext('https://shop.example.com/p', `<html><head>${markup}</head><body></body></html>`);
        expect(platformFingerprint(page), markup).toBe(expected);
      }
    });

    it('reads the Shopify header when the markup says nothing', () => {
      const page = mockPageContext('https://shop.example.com/p', '<html><body></body></html>');
      page.fetchResult.headers['x-shopid'] = '12345';
      expect(platformFingerprint(page)).toBe('shopify');
    });

    it('returns undefined for a page with no fingerprint', () => {
      const page = mockPageContext('https://example.com/', '<html><body><p>Hi.</p></body></html>');
      expect(platformFingerprint(page)).toBeUndefined();
    });
  });
});
