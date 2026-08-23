import { describe, it, expect, vi } from 'vitest';
import { AgentCommerceFeedParityAudit } from './agent-commerce-feed-parity';
import { mockPageContext, mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';
import { expectNotApplicableOnEmpty } from '../../tests/na-contract';
import type { FetchOptions, FetchResult } from '../../fetcher';

vi.mock('../../fetcher', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../fetcher')>();
  return {
    ...actual,
    isSafeUrl: async (url: string) => {
      try {
        const { protocol, hostname } = new URL(url);
        if (protocol !== 'http:' && protocol !== 'https:') return false;
        return !/^(localhost$|127\.|\[?::1\]?$|10\.|192\.168\.)/.test(hostname);
      } catch {
        return false;
      }
    },
  };
});

const URL_0 = 'https://example.com/products/p-0';

/** A product whose every audited field is correct. */
function product(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Alpine Resole Kit',
    sku: 'ARK-001',
    description: 'A plain-text description of the resole kit, with no markup at all.',
    brand: { '@type': 'Brand', name: 'Alpine' },
    image: 'https://example.com/img/ark-001.jpg',
    url: URL_0,
    itemCondition: 'https://schema.org/NewCondition',
    offers: {
      '@type': 'Offer',
      price: 29.99,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      seller: { '@type': 'Organization', name: 'Alpine Store' },
      eligibleRegion: 'US',
      url: URL_0,
    },
  };
}

interface PageOptions {
  /** Price rendered in the page copy. Defaults to the JSON-LD price. */
  visiblePrice?: string;
  /** Extra body markup, e.g. a variant selector. */
  body?: string;
  /** Canonical href. Defaults to the page URL. */
  canonical?: string;
}

function pageHtml(node: Record<string, unknown>, opts: PageOptions = {}): string {
  const price = opts.visiblePrice ?? '$29.99';
  return `<html><head>
    <link rel="canonical" href="${opts.canonical ?? URL_0}">
    <script type="application/ld+json">${JSON.stringify(node)}</script>
  </head><body><main>
    <h1>Alpine Resole Kit</h1><p class="price">${price}</p>${opts.body ?? ''}
  </main></body></html>`;
}

function run(html: string | undefined, imageType = 'image/jpeg') {
  const audit = new AgentCommerceFeedParityAudit();
  const ctx = mockCheckContext([
    mockPageContext('https://example.com/', '<html><body><main><p>Home.</p></main></body></html>'),
  ]);
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${URL_0}</loc></url></urlset>`;

  ctx.fetch = async (o: FetchOptions): Promise<FetchResult> => {
    const path = new URL(o.url).pathname;
    if (path === '/sitemap.xml') return mockFetchResult(xml, 200, 'application/xml');
    if (o.method === 'HEAD') return mockFetchResult('', 200, imageType);
    if (o.url === URL_0 && html) return mockFetchResult(html, 200, 'text/html');
    return mockFetchResult('', 404);
  };
  return audit.audit(ctx);
}

describe('AgentCommerceFeedParityAudit', () => {
  const audit = new AgentCommerceFeedParityAudit();

  it('is notApplicable on an empty site', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it('is notApplicable when the sitemap sample holds no product page', async () => {
    const result = await run('<html><head></head><body><main><p>An article.</p></main></body></html>');
    expect(result.status).toBe('na');
  });

  it('passes a product page that satisfies both feed specs', async () => {
    const result = await run(pageHtml(product()));
    expect(result.status).toBe('pass');
  });

  // The single most common defect in the wild: the enum name without its URL.
  it('fails on a bare availability token instead of the schema.org URL', async () => {
    const node = product();
    (node['offers'] as Record<string, unknown>)['availability'] = 'InStock';
    const result = await run(pageHtml(node));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('availability');
  });

  it('fails on a description that still carries HTML tags', async () => {
    const node = product();
    node['description'] = 'A resole kit with <strong>every</strong> tool included.';
    const result = await run(pageHtml(node));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('description');
  });

  it('fails on an itemCondition outside the three schema.org condition URLs', async () => {
    const node = product();
    node['itemCondition'] = 'https://schema.org/DamagedCondition';
    const result = await run(pageHtml(node));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('itemCondition');
  });

  it('fails when no field carries a target-country signal', async () => {
    const node = product();
    delete (node['offers'] as Record<string, unknown>)['eligibleRegion'];
    const result = await run(pageHtml(node));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('country');
  });

  it('accepts shippingDetails.shippingDestination.addressCountry as the country signal', async () => {
    const node = product();
    const offers = node['offers'] as Record<string, unknown>;
    delete offers['eligibleRegion'];
    offers['shippingDetails'] = {
      '@type': 'OfferShippingDetails',
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'US' },
    };
    expect((await run(pageHtml(node))).status).toBe('pass');
  });

  it('fails when the page exposes sibling variants but no item_group_id source', async () => {
    const body =
      '<select name="variant"><option value="s">Small</option><option value="m">Medium</option></select>';
    const result = await run(pageHtml(product(), { body }));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('item_group_id');
  });

  it('accepts inProductGroupWithID as the item_group_id source', async () => {
    const node = product();
    node['inProductGroupWithID'] = 'ARK';
    const body =
      '<select name="variant"><option value="s">Small</option><option value="m">Medium</option></select>';
    expect((await run(pageHtml(node, { body }))).status).toBe('pass');
  });

  // Automatic item updates overwrite the feed from the page, so the two prices
  // must be the same number.
  it('fails when the JSON-LD price is absent from the prices rendered on the page', async () => {
    const result = await run(pageHtml(product(), { visiblePrice: '$39.99' }));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('29.99');
    expect(result.message).toContain('39.99');
  });

  it('fails when offers.url disagrees with rel=canonical', async () => {
    const result = await run(
      pageHtml(product(), { canonical: 'https://example.com/products/p-0-canonical' }),
    );
    expect(result.status).toBe('fail');
    expect(result.message).toContain('canonical');
  });

  // WebP is valid on the page and a risk in the feed, which is a warning, not a
  // rejection.
  it('warns on a WebP-only image', async () => {
    const node = product();
    node['image'] = 'https://example.com/img/ark-001.webp';
    const result = await run(pageHtml(node), 'image/webp');
    expect(result.status).toBe('warn');
    expect(result.message).toContain('image/webp');
  });

  it('reports the agent-commerce gap as its own sub-score', async () => {
    const result = await run(pageHtml(product()));
    expect(result.found).toContain('agent-commerce gap');
  });
});
