import { describe, it, expect } from 'vitest';
import { LandedCostAndReturnsAudit } from './landed-cost-and-returns';
import { mockPageContext, mockCheckContext } from '../../__tests__/test-utils';
import { expectNotApplicableOnEmpty } from '../../tests/na-contract';

const ld = (obj: unknown) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
const productPage = (head: string) =>
  mockPageContext('https://example.com/products/widget', `<html><head>${head}</head><body><main><p>Widget</p></main></body></html>`, 1);
const homePage = (head = '') =>
  mockPageContext('https://example.com/', `<html><head>${head}</head><body><main><p>Home</p></main></body></html>`, 0);

const FULL_SHIPPING = {
  '@type': 'OfferShippingDetails',
  name: 'standard',
  shippingRate: { '@type': 'MonetaryAmount', value: 5.99, currency: 'USD' },
  shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'US' },
  deliveryTime: {
    '@type': 'ShippingDeliveryTime',
    handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
    transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 3, unitCode: 'DAY' },
  },
};

const FULL_RETURNS = {
  '@type': 'MerchantReturnPolicy',
  applicableCountry: 'US',
  returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
  merchantReturnDays: 30,
};

function product(offerExtras: Record<string, unknown>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Widget',
    offers: { '@type': 'Offer', price: '29.99', priceCurrency: 'USD', ...offerExtras },
  };
}

function run(offerExtras: Record<string, unknown>) {
  const audit = new LandedCostAndReturnsAudit();
  return audit.audit(mockCheckContext([homePage(), productPage(ld(product(offerExtras)))]));
}

describe('LandedCostAndReturnsAudit', () => {
  const audit = new LandedCostAndReturnsAudit();

  it('is notApplicable on an empty site', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it('is notApplicable when no product page was scanned', () => {
    const result = audit.audit(mockCheckContext([homePage()]));
    expect(result.status).toBe('na');
  });

  it('passes when both legs are fully machine-readable', () => {
    const result = run({ shippingDetails: FULL_SHIPPING, hasMerchantReturnPolicy: FULL_RETURNS });
    expect(result.status).toBe('pass');
  });

  // The exact strings the merchant pastes into the feed.
  it('synthesises the feed values the legs map to', () => {
    const result = run({ shippingDetails: FULL_SHIPPING, hasMerchantReturnPolicy: FULL_RETURNS });
    expect(result.found).toContain('US::standard:5.99:1:3');
    expect(result.found).toContain('return_deadline_in_days=30');
  });

  // handlingTime and transitTime are nested under deliveryTime, not direct
  // properties of OfferShippingDetails.
  it('fails the shipping leg when handlingTime sits directly on OfferShippingDetails', () => {
    const misplaced = {
      '@type': 'OfferShippingDetails',
      shippingRate: { '@type': 'MonetaryAmount', value: 5.99, currency: 'USD' },
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'US' },
      handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
      deliveryTime: {
        '@type': 'ShippingDeliveryTime',
        transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 3, unitCode: 'DAY' },
      },
    };
    const result = run({ shippingDetails: misplaced, hasMerchantReturnPolicy: FULL_RETURNS });
    expect(result.status).toBe('fail');
    expect(result.message).toContain('deliveryTime');
  });

  it('accepts doesNotShip:true as an explicit shipping answer', () => {
    const result = run({
      shippingDetails: { '@type': 'OfferShippingDetails', doesNotShip: true },
      hasMerchantReturnPolicy: FULL_RETURNS,
    });
    expect(result.status).toBe('pass');
  });

  it('fails the returns leg when a finite window carries no merchantReturnDays', () => {
    const { merchantReturnDays: _drop, ...noDays } = FULL_RETURNS;
    const result = run({ shippingDetails: FULL_SHIPPING, hasMerchantReturnPolicy: noDays });
    expect(result.status).toBe('fail');
    expect(result.message).toContain('merchantReturnDays');
  });

  // A URL is not a number an agent can compare.
  it('warns, never passes, on a policy that only carries a merchantReturnLink', () => {
    const result = run({
      shippingDetails: FULL_SHIPPING,
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        merchantReturnLink: 'https://example.com/returns',
      },
    });
    expect(result.status).toBe('warn');
    expect(result.message).toContain('merchantReturnLink');
  });

  it('reads a returns policy declared on the Organization node', () => {
    const audit2 = new LandedCostAndReturnsAudit();
    const org = ld({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Acme',
      hasMerchantReturnPolicy: FULL_RETURNS,
    });
    const result = audit2.audit(
      mockCheckContext([homePage(org), productPage(ld(product({ shippingDetails: FULL_SHIPPING })))]),
    );
    expect(result.status).toBe('pass');
  });

  it('fails an Offer that carries neither leg', () => {
    const result = run({});
    expect(result.status).toBe('fail');
  });

  it('reports the product page the offer is on', () => {
    const result = run({ shippingDetails: FULL_SHIPPING, hasMerchantReturnPolicy: FULL_RETURNS });
    expect(result.pageUrl).toBe('https://example.com/products/widget');
  });
});
