import { describe, it, expect } from 'vitest';
import {
  OfferTruthConsistencyAudit,
  duplicateConflicts,
  renderedCurrencies,
} from './offer-truth-consistency';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';
import { expectNotApplicableOnEmpty } from '../../tests/na-contract';
import type { AuditResult } from '../../types';

const strings = (result: AuditResult, key: string): string[] => (result.details?.[key] ?? []) as string[];

const ld = (data: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(data)}</script>`;

interface Offer {
  price?: string;
  priceCurrency?: string;
  availability?: string;
  priceValidUntil?: string;
}

const offer = (over: Offer = {}) => ({
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Merino Crew',
  url: 'https://example.com/products/merino-crew',
  sku: 'MC-100',
  offers: {
    '@type': 'Offer',
    price: '59.00',
    priceCurrency: 'GBP',
    availability: 'https://schema.org/InStock',
    ...over,
  },
});

/** A product page: h1, a price node, a buy button, plus whatever is passed. */
function page(body: string) {
  return mockPageContext(
    'https://example.com/products/merino-crew',
    `<html><head><title>Merino Crew</title></head><body><main>${body}</main></body></html>`,
    1,
  );
}

function run(body: string) {
  return new OfferTruthConsistencyAudit().audit(mockCheckContext([page(body)]));
}

const SOLD_OUT = '<h1>Merino Crew</h1><p class="price">£59.00</p><p>Sold out</p>';
const IN_STOCK = '<h1>Merino Crew</h1><p class="price">£59.00</p><button>Add to cart</button>';

describe('OfferTruthConsistencyAudit', () => {
  it('is notApplicable on an empty site', async () => {
    await expectNotApplicableOnEmpty(new OfferTruthConsistencyAudit());
  });

  it('is notApplicable when no scanned page is a product page', () => {
    const ctx = mockCheckContext([]);
    expect(new OfferTruthConsistencyAudit().audit(ctx).status).toBe('na');
  });

  it('passes a page whose markup matches what it renders', () => {
    const r = run(IN_STOCK + ld(offer({ priceValidUntil: '2099-12-31' })));
    expect(r.status).toBe('pass');
    expect(r.details?.['contradictions']).toBe(0);
  });

  it('fails InStock markup on a page that says sold out', () => {
    const r = run(SOLD_OUT + ld(offer()));
    expect(r.status).toBe('fail');
    expect(strings(r, 'failures')[0]).toContain('sold out');
  });

  it('fails InStock markup when the add-to-cart control is disabled', () => {
    const body = '<h1>Merino Crew</h1><p class="price">£59.00</p><button disabled>Add to cart</button>';
    expect(strings(run(body + ld(offer())), 'failures')[0]).toContain('disabled');
  });

  it('fails an offer whose priceValidUntil has passed', () => {
    const r = run(IN_STOCK + ld(offer({ priceValidUntil: '2020-01-31' })));
    expect(r.status).toBe('fail');
    expect(strings(r, 'failures')[0]).toContain('priceValidUntil 2020-01-31');
  });

  it('fails when no rendered price is within 1% of the declared one', () => {
    const body = '<h1>Merino Crew</h1><p class="price">£49.00</p><button>Add to cart</button>';
    const r = run(body + ld(offer({ priceValidUntil: '2099-12-31' })));
    expect(r.status).toBe('fail');
    expect(strings(r, 'failures')[0]).toContain('declares 59');
  });

  // A "was £79, now £59" page is correct, not divergent.
  it('accepts a struck-through price as a non-match', () => {
    const body =
      '<h1>Merino Crew</h1><p class="price"><del>£79.00</del> <span>£59.00</span></p><button>Add to cart</button>';
    expect(run(body + ld(offer({ priceValidUntil: '2099-12-31' }))).status).toBe('pass');
  });

  it('fails a rendered currency that cannot be the declared one', () => {
    const body = '<h1>Merino Crew</h1><p class="price">$59.00</p><button>Add to cart</button>';
    const r = run(body + ld(offer({ priceValidUntil: '2099-12-31' })));
    expect(r.status).toBe('fail');
    expect(strings(r, 'failures').join(' ')).toContain('declares GBP');
  });

  it('fails a sale price at or above the struck-through price', () => {
    const body =
      '<h1>Merino Crew</h1><p class="price"><del>£59.00</del> <span>£59.00</span></p><button>Add to cart</button>';
    const r = run(body + ld(offer({ priceValidUntil: '2099-12-31' })));
    expect(strings(r, 'failures').join(' ')).toContain('at or above');
  });

  it('fails two Product nodes for one URL that disagree', () => {
    const r = run(
      IN_STOCK +
        ld([offer({ priceValidUntil: '2099-12-31' }), offer({ price: '69.00', priceValidUntil: '2099-12-31' })]),
    );
    expect(r.status).toBe('fail');
    expect(strings(r, 'failures').join(' ')).toContain('described twice');
  });

  it('fails a rendered price with no offers.price in the markup', () => {
    const body = '<h1>Merino Crew</h1><p class="price">£59.00</p><button>Add to cart</button>';
    const r = run(body + ld({ '@type': 'Product', name: 'Merino Crew', sku: 'MC-100' }));
    expect(r.status).toBe('fail');
    expect(strings(r, 'failures')[0]).toContain('declares no offers.price');
  });

  it('warns, never fails, when neither the HTML nor the markup carries a price', () => {
    const r = run('<h1>Merino Crew</h1><div id="price-root"></div>');
    expect(r.status).toBe('warn');
    expect(strings(r, 'warnings')[0]).toContain('injected client-side');
  });

  // A carousel of other products must not supply the price under comparison.
  it('ignores prices outside the product region', () => {
    const body = `<h1>Merino Crew</h1><p class="price">£59.00</p><button>Add to cart</button>`;
    const carousel = `<aside><h2>You may also like</h2><p>£12.00</p><p>£15.00</p></aside>`;
    expect(run(body + carousel + ld(offer({ priceValidUntil: '2099-12-31' }))).status).toBe('pass');
  });

  it('reads currency tokens rendered next to a number', () => {
    expect(renderedCurrencies('Now £59.00, was £79.00')).toEqual(['£']);
    expect(renderedCurrencies('59,00 €')).toEqual(['€']);
    expect(renderedCurrencies('Price: 59.00 USD')).toEqual(['USD']);
    expect(renderedCurrencies('Ships in 3 days')).toEqual([]);
  });

  it('finds a duplicate conflict only when the offers disagree', () => {
    const same = [offer(), offer()].map((node) => node as Record<string, unknown>);
    expect(duplicateConflicts(same)).toEqual([]);
    const different = [offer(), offer({ availability: 'https://schema.org/OutOfStock' })].map(
      (node) => node as Record<string, unknown>,
    );
    expect(duplicateConflicts(different)).toHaveLength(1);
  });
});
