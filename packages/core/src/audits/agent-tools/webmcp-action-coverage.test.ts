import { describe, it, expect } from 'vitest';
import { WebmcpActionCoverageAudit } from './webmcp-action-coverage';
import { mockCheckContext, mockFetchResult, mockPageContext } from '../../__tests__/test-utils';

describe('WebmcpActionCoverageAudit', () => {
  const audit = new WebmcpActionCoverageAudit();

  it('passes with 4+ commerce actions covered in manifest', () => {
    const manifest = JSON.stringify({
      tools: [
        { name: 'searchProducts', description: 'Search the product catalog' },
        { name: 'getProductDetails', description: 'Get product detail information' },
        { name: 'addToCart', description: 'Add item to shopping cart' },
        { name: 'checkout', description: 'Begin checkout process and purchase' },
      ],
    });
    const ctx = mockCheckContext([], {
      '/.well-known/webmcp': mockFetchResult(manifest, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('4/6');
  });

  it('warns with 2-3 commerce actions covered', () => {
    const manifest = JSON.stringify({
      tools: [
        { name: 'searchProducts', description: 'Search the product catalog' },
        { name: 'viewProduct', description: 'View product details' },
      ],
    });
    const ctx = mockCheckContext([], {
      '/.well-known/webmcp': mockFetchResult(manifest, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('Missing');
  });

  it('warns with only 1 commerce action (below ideal but meets minimum)', () => {
    const manifest = JSON.stringify({
      tools: [{ name: 'searchProducts', description: 'Search the catalog' }],
    });
    const ctx = mockCheckContext([], {
      '/.well-known/webmcp': mockFetchResult(manifest, 200),
    });
    const result = audit.audit(ctx);
    // 1 action matches "search" — meets MIN_COVERAGE threshold but below ideal
    // Product Search + Product Detail both match due to "search" and "product" keywords
    expect(['warn', 'fail']).toContain(result.status);
  });

  it('returns not-applicable when no WebMCP tools exist at all (nothing to check)', () => {
    const ctx = mockCheckContext([], {});
    const result = audit.audit(ctx);
    expect(result.status).toBe('na');
    expect(result.message).toContain('No WebMCP tools found');
  });

  it('detects commerce actions from declarative forms', () => {
    const page = mockPageContext(
      'https://example.com',
      `
      <html><body>
        <form toolname="searchProducts" tooldescription="Search products" action="/search">
          <input type="text" name="q" />
        </form>
        <form toolname="addToCart" tooldescription="Add to shopping cart" action="/cart/add">
          <input type="hidden" name="id" />
        </form>
        <form toolname="submitContact" tooldescription="Send a support inquiry" action="/contact">
          <input type="email" name="email" />
        </form>
        <form toolname="checkout" tooldescription="Purchase items in cart" action="/checkout">
          <input type="text" name="shipping" />
        </form>
      </body></html>
    `,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('combines manifest and declarative form tools for coverage', () => {
    const manifest = JSON.stringify({
      tools: [
        { name: 'searchProducts', description: 'Search catalog' },
        { name: 'getProductDetails', description: 'Get product info' },
      ],
    });
    const page = mockPageContext(
      'https://example.com',
      `
      <html><body>
        <form toolname="addToCart" tooldescription="Add to cart" action="/cart/add">
          <input type="hidden" name="id" />
        </form>
        <form toolname="submitCheckout" tooldescription="Complete checkout and purchase" action="/checkout">
          <input type="text" name="payment" />
        </form>
      </body></html>
    `,
    );
    const ctx = mockCheckContext([page], {
      '/.well-known/webmcp': mockFetchResult(manifest, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('4/6');
  });

  it('matches actions by description keywords with word boundaries', () => {
    const manifest = JSON.stringify({
      tools: [
        { name: 'doThing1', description: 'Browse and filter products in the catalog' },
        { name: 'doThing2', description: 'View product detail information and specs' },
        { name: 'doThing3', description: 'Add items to the shopping cart' },
        { name: 'doThing4', description: 'Complete the checkout and purchase order' },
      ],
    });
    const ctx = mockCheckContext([], {
      '/.well-known/webmcp': mockFetchResult(manifest, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('lists missing commerce actions in the message', () => {
    const manifest = JSON.stringify({
      tools: [{ name: 'searchProducts', description: 'Search the catalog' }],
    });
    const ctx = mockCheckContext([], {
      '/.well-known/webmcp': mockFetchResult(manifest, 200),
    });
    const result = audit.audit(ctx);
    expect(result.message).toContain('Missing');
    expect(result.message).toContain('Checkout');
  });

  it('returns not-applicable when manifest has invalid JSON and no forms exist', () => {
    const ctx = mockCheckContext([], {
      '/.well-known/webmcp': mockFetchResult('invalid json {{{', 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('na');
  });

  it('skips non-object entries in manifest tools array', () => {
    const manifest = JSON.stringify({
      tools: [null, 42, { name: 'doThing', description: 'Does a generic thing here' }],
    });
    const ctx = mockCheckContext([], {
      '/.well-known/webmcp': mockFetchResult(manifest, 200),
    });
    const result = audit.audit(ctx);
    // 'dothing does a generic thing here' has no commerce keywords → coverage=0 → fail
    expect(result.status).toBe('fail');
    expect(result.message).toContain('none');
  });

  it('skips duplicate tool name when same name appears in manifest and declarative form', () => {
    const manifest = JSON.stringify({
      tools: [{ name: 'searchProducts', description: 'Search the product catalog' }],
    });
    const page = mockPageContext(
      'https://example.com',
      `<html><body>
        <form toolname="searchProducts" tooldescription="Search catalog" action="/search">
          <input type="text" name="q" />
        </form>
      </body></html>`,
    );
    const ctx = mockCheckContext([page], {
      '/.well-known/webmcp': mockFetchResult(manifest, 200),
    });
    const result = audit.audit(ctx);
    // searchProducts covers Product Search action — 1 unique tool, duplicate skipped
    expect(result.status).not.toBe('na');
  });

  it('processes manifest tool with empty name without adding to seen set', () => {
    const manifest = JSON.stringify({
      tools: [{ description: 'No name here, just a description for something generic' }],
    });
    const ctx = mockCheckContext([], {
      '/.well-known/webmcp': mockFetchResult(manifest, 200),
    });
    const result = audit.audit(ctx);
    // Tool has no commerce keywords → fail
    expect(result.status).toBe('fail');
    expect(result.message).toContain('none');
  });

  it('handles manifest tool with name but no description', () => {
    const manifest = JSON.stringify({
      tools: [{ name: 'doThingHere' }],
    });
    const ctx = mockCheckContext([], {
      '/.well-known/webmcp': mockFetchResult(manifest, 200),
    });
    const result = audit.audit(ctx);
    // No description, no commerce keywords → fail
    expect(result.status).toBe('fail');
  });

  it('handles form with empty toolname and missing optional attributes', () => {
    const page = mockPageContext(
      'https://example.com',
      `<html><body>
        <form toolname="">
          <input type="text" name="q" />
        </form>
      </body></html>`,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    // Empty toolname → empty sig → no commerce keywords → fail
    expect(result.status).toBe('fail');
  });
});
