import { describe, it, expect } from 'vitest';
import { WebmcpToolNamingAudit } from './webmcp-tool-naming';
import { mockCheckContext, mockFetchResult, mockPageContext } from '../../__tests__/test-utils';

describe('WebmcpToolNamingAudit', () => {
  const audit = new WebmcpToolNamingAudit();

  it('passes when all tools follow naming conventions', () => {
    const manifest = JSON.stringify({
      tools: [
        {
          name: 'searchProducts',
          description: 'Search the product catalog by keyword and filters',
        },
        { name: 'addToCart', description: 'Add a product to the shopping cart with quantity' },
      ],
    });
    const ctx = mockCheckContext([], {
      '/.well-known/webmcp': mockFetchResult(manifest, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('returns not-applicable when no WebMCP tools exist', () => {
    const ctx = mockCheckContext([], {});
    const result = audit.audit(ctx);
    expect(result.status).toBe('na');
    expect(result.message).toContain('No WebMCP tools');
  });

  it('warns when some tools have non-verb names', () => {
    const manifest = JSON.stringify({
      tools: [
        {
          name: 'searchProducts',
          description: 'Search the product catalog by keyword and filters',
        },
        { name: 'products', description: 'Shows the product listing page for browsing' },
      ],
    });
    const ctx = mockCheckContext([], {
      '/.well-known/webmcp': mockFetchResult(manifest, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('products');
  });

  it('fails when most tools have bad names', () => {
    const manifest = JSON.stringify({
      tools: [
        { name: 'form1', description: 'The main form on the page for user input' },
        { name: 'action2', description: 'Another action handler for the page' },
        { name: 'data', description: 'Data endpoint' },
      ],
    });
    const ctx = mockCheckContext([], {
      '/.well-known/webmcp': mockFetchResult(manifest, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
  });

  it('flags tools with short descriptions', () => {
    const manifest = JSON.stringify({
      tools: [{ name: 'searchProducts', description: 'Search' }],
    });
    const ctx = mockCheckContext([], {
      '/.well-known/webmcp': mockFetchResult(manifest, 200),
    });
    const result = audit.audit(ctx);
    expect(result.message).toContain('short descriptions');
  });

  it('checks declarative forms too', () => {
    const page = mockPageContext(
      'https://example.com',
      `
      <html><body>
        <form toolname="searchProducts" tooldescription="Search the product catalog by keyword and category">
          <input type="text" name="q" />
        </form>
      </body></html>
    `,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('combines manifest and declarative form tools', () => {
    const manifest = JSON.stringify({
      tools: [
        {
          name: 'searchProducts',
          description: 'Search the product catalog by keyword and filters',
        },
      ],
    });
    const page = mockPageContext(
      'https://example.com',
      `
      <html><body>
        <form toolname="form1" tooldescription="A form">
          <input type="text" name="q" />
        </form>
      </body></html>
    `,
    );
    const ctx = mockCheckContext([page], {
      '/.well-known/webmcp': mockFetchResult(manifest, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    // 1 good name (searchProducts) + 1 bad name (form1) = 50%
  });

  it('returns not-applicable when manifest has invalid JSON and no forms', () => {
    const ctx = mockCheckContext([], {
      '/.well-known/webmcp': mockFetchResult('invalid json {{{', 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('na');
  });

  it('skips declarative form when tool name already seen in manifest', () => {
    const manifest = JSON.stringify({
      tools: [
        {
          name: 'searchProducts',
          description: 'Search the product catalog by keyword and filters',
        },
      ],
    });
    const page = mockPageContext(
      'https://example.com',
      `<html><body>
        <form toolname="searchProducts" tooldescription="Search the product catalog by keyword">
          <input type="text" name="q" />
        </form>
      </body></html>`,
    );
    const ctx = mockCheckContext([page], {
      '/.well-known/webmcp': mockFetchResult(manifest, 200),
    });
    const result = audit.audit(ctx);
    // Duplicate form skipped; only 1 tool counted from manifest
    expect(result.status).toBe('pass');
    expect(result.message).toContain('1 tool(s)');
  });

  it('processes manifest tool with empty name without adding to seen set', () => {
    const manifest = JSON.stringify({
      tools: [{ description: 'Search the product catalog by keyword and filters' }],
    });
    const ctx = mockCheckContext([], {
      '/.well-known/webmcp': mockFetchResult(manifest, 200),
    });
    const result = audit.audit(ctx);
    // Tool has empty name (fails verb pattern), adequate description
    // 0/1 good names → fail
    expect(result.status).toBe('fail');
  });

  it('counts form with empty toolname without adding to seen set', () => {
    const page = mockPageContext(
      'https://example.com',
      `<html><body>
        <form toolname="" tooldescription="Search the product catalog by keyword and category">
          <input type="text" name="q" />
        </form>
      </body></html>`,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    // Empty name fails verb pattern; 0/1 good names → fail
    expect(result.status).toBe('fail');
  });

  it('skips non-object entries in manifest tools array', () => {
    const manifest = JSON.stringify({
      tools: [null, 42, { name: 'searchProducts', description: 'Search the product catalog by keyword and filters' }],
    });
    const ctx = mockCheckContext([], {
      '/.well-known/webmcp': mockFetchResult(manifest, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('handles manifest tool with name but no description', () => {
    const manifest = JSON.stringify({
      tools: [{ name: 'searchProducts' }],
    });
    const ctx = mockCheckContext([], {
      '/.well-known/webmcp': mockFetchResult(manifest, 200),
    });
    const result = audit.audit(ctx);
    // Good name but short/empty description → flagged
    expect(result.message).toContain('short descriptions');
  });

  it('handles form with toolname but no tooldescription', () => {
    const page = mockPageContext(
      'https://example.com',
      `<html><body>
        <form toolname="searchProducts">
          <input type="text" name="q" />
        </form>
      </body></html>`,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    // Good name but empty description → flagged
    expect(result.message).toContain('short descriptions');
  });
});
