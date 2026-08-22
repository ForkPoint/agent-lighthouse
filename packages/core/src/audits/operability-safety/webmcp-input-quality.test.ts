import { describe, it, expect } from 'vitest';
import { WebmcpInputQualityAudit } from './webmcp-input-quality';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('WebmcpInputQualityAudit', () => {
  const audit = new WebmcpInputQualityAudit();

  it('passes when all inputs have names and labels', () => {
    const page = mockPageContext(
      'https://example.com',
      `
      <html><body>
        <form toolname="searchProducts" tooldescription="Search products">
          <label for="q">Search query</label>
          <input id="q" type="text" name="query" />
          <label for="cat">Category</label>
          <select id="cat" name="category">
            <option value="all">All</option>
          </select>
        </form>
      </body></html>
    `,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('returns not-applicable when no WebMCP forms exist (nothing to check)', () => {
    const page = mockPageContext(
      'https://example.com',
      `
      <html><body>
        <form action="/search">
          <input type="text" name="q" />
        </form>
      </body></html>
    `,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('na');
    expect(result.message).toContain('No WebMCP-declared forms');
  });

  it('warns when some inputs lack names', () => {
    const page = mockPageContext(
      'https://example.com',
      `
      <html><body>
        <form toolname="searchProducts" tooldescription="Search products">
          <label for="q">Query</label>
          <input id="q" type="text" name="query" />
          <input type="text" />
        </form>
      </body></html>
    `,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
  });

  it('fails when most inputs lack names', () => {
    const page = mockPageContext(
      'https://example.com',
      `
      <html><body>
        <form toolname="searchProducts" tooldescription="Search products">
          <input type="text" />
          <input type="text" />
          <input type="text" />
        </form>
      </body></html>
    `,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('0/3');
  });

  it('skips hidden and submit inputs', () => {
    const page = mockPageContext(
      'https://example.com',
      `
      <html><body>
        <form toolname="addToCart" tooldescription="Add to cart">
          <input type="hidden" name="product_id" value="123" />
          <label for="qty">Quantity</label>
          <input id="qty" type="number" name="quantity" />
          <input type="submit" value="Add" />
        </form>
      </body></html>
    `,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    // Only 1 visible input (quantity), which has both name and label
  });

  it('accepts aria-label as a valid label', () => {
    const page = mockPageContext(
      'https://example.com',
      `
      <html><body>
        <form toolname="searchProducts" tooldescription="Search">
          <input type="text" name="query" aria-label="Search query" />
        </form>
      </body></html>
    `,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('accepts placeholder as a valid label', () => {
    const page = mockPageContext(
      'https://example.com',
      `
      <html><body>
        <form toolname="searchProducts" tooldescription="Search">
          <input type="text" name="query" placeholder="Search products..." />
        </form>
      </body></html>
    `,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('warns when WebMCP form has no visible inputs', () => {
    const page = mockPageContext(
      'https://example.com',
      `
      <html><body>
        <form toolname="refresh" tooldescription="Refresh data">
          <input type="hidden" name="token" value="abc" />
          <input type="submit" value="Refresh" />
        </form>
      </body></html>
    `,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('no visible inputs');
  });

  it('tracks quality across multiple WebMCP forms on the same page', () => {
    const page = mockPageContext(
      'https://example.com',
      `
      <html><body>
        <form toolname="searchProducts" tooldescription="Search products">
          <input type="text" name="query" placeholder="Search..." />
        </form>
        <form toolname="addToCart" tooldescription="Add to cart">
          <input type="text" name="productId" placeholder="Product ID" />
        </form>
      </body></html>
    `,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('2 input(s) across 2 WebMCP form(s)');
  });
});
