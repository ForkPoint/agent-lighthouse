import { describe, it, expect } from 'vitest';
import { WebmcpDeclarativeFormsAudit } from './webmcp-declarative-forms';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('WebmcpDeclarativeFormsAudit', () => {
  const audit = new WebmcpDeclarativeFormsAudit();

  it('passes when all forms have toolname and tooldescription', () => {
    const page = mockPageContext(
      'https://example.com',
      `
      <html><body>
        <form toolname="searchProducts" tooldescription="Search the product catalog" action="/search" method="GET">
          <input type="text" name="q" />
        </form>
        <form toolname="addToCart" tooldescription="Add a product to cart" action="/cart/add" method="POST">
          <input type="hidden" name="id" />
        </form>
      </body></html>
    `,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('searchProducts');
    expect(result.message).toContain('addToCart');
  });

  it('warns when some forms have WebMCP attributes and some do not', () => {
    const page = mockPageContext(
      'https://example.com',
      `
      <html><body>
        <form toolname="searchProducts" tooldescription="Search products" action="/search">
          <input type="text" name="q" />
        </form>
        <form action="/newsletter" method="POST">
          <input type="email" name="email" />
        </form>
      </body></html>
    `,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('1/2');
  });

  it('fails when no forms have WebMCP attributes', () => {
    const page = mockPageContext(
      'https://example.com',
      `
      <html><body>
        <form action="/search" method="GET">
          <input type="text" name="q" />
        </form>
        <form action="/contact" method="POST">
          <input type="email" name="email" />
        </form>
      </body></html>
    `,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('none have WebMCP');
  });

  it('warns when no forms exist on any page', () => {
    const page = mockPageContext(
      'https://example.com',
      `
      <html><body><p>No forms here</p></body></html>
    `,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No forms found');
  });

  it('handles forms with tooldescription but no toolname', () => {
    const page = mockPageContext(
      'https://example.com',
      `
      <html><body>
        <form tooldescription="Search products" action="/search">
          <input type="text" name="q" />
        </form>
      </body></html>
    `,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    // Partial implementation counts as a WebMCP form
    expect(result.status).toBe('pass');
  });

  it('works across multiple pages', () => {
    const page1 = mockPageContext(
      'https://example.com',
      `
      <html><body>
        <form toolname="searchProducts" tooldescription="Search" action="/search">
          <input type="text" name="q" />
        </form>
      </body></html>
    `,
    );
    const page2 = mockPageContext(
      'https://example.com/contact',
      `
      <html><body>
        <form action="/contact" method="POST">
          <input type="email" name="email" />
        </form>
      </body></html>
    `,
      1,
    );
    const ctx = mockCheckContext([page1, page2]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('1/2');
  });

  it('does not overwrite firstPageUrl when tooldescription-only form follows a toolname form', () => {
    const page = mockPageContext(
      'https://example.com',
      `
      <html><body>
        <form toolname="searchProducts" tooldescription="Search products" action="/search">
          <input type="text" name="q" />
        </form>
        <form tooldescription="Another tool with description only" action="/other">
          <input type="text" name="data" />
        </form>
      </body></html>
    `,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    // Both forms counted as WebMCP (1 with toolname, 1 with tooldescription only)
    // webmcpForms (2) === totalForms (2) → pass
    expect(result.status).toBe('pass');
    expect(result.message).toContain('2 form(s)');
  });
});
