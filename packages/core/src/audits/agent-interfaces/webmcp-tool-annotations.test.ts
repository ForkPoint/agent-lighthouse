import { describe, it, expect } from 'vitest';
import { WebmcpToolAnnotationsAudit } from './webmcp-tool-annotations';
import { mockCheckContext, mockFetchResult, mockPageContext } from '../../__tests__/test-utils';

describe('WebmcpToolAnnotationsAudit', () => {
  const audit = new WebmcpToolAnnotationsAudit();

  it('passes when all manifest tools have annotations', () => {
    const manifest = JSON.stringify({
      tools: [
        {
          name: 'searchProducts',
          description: 'Search products',
          annotations: { readOnlyHint: true, destructiveHint: false },
        },
        {
          name: 'addToCart',
          description: 'Add to cart',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
        },
      ],
    });
    const ctx = mockCheckContext([], {
      '/.well-known/webmcp': mockFetchResult(manifest, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('readOnlyHint');
  });

  it('returns not-applicable when no WebMCP tools exist', () => {
    const ctx = mockCheckContext([], {});
    const result = audit.audit(ctx);
    expect(result.status).toBe('na');
  });

  it('fails when no tools have annotations', () => {
    const manifest = JSON.stringify({
      tools: [
        { name: 'searchProducts', description: 'Search products' },
        { name: 'addToCart', description: 'Add to cart' },
      ],
    });
    const ctx = mockCheckContext([], {
      '/.well-known/webmcp': mockFetchResult(manifest, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('None of the 2');
  });

  it('warns when some tools have annotations and some do not', () => {
    const manifest = JSON.stringify({
      tools: [
        {
          name: 'searchProducts',
          description: 'Search',
          annotations: { readOnlyHint: true },
        },
        { name: 'addToCart', description: 'Add to cart' },
      ],
    });
    const ctx = mockCheckContext([], {
      '/.well-known/webmcp': mockFetchResult(manifest, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('1/2');
  });

  it('detects annotations on declarative forms via data attributes', () => {
    const page = mockPageContext(
      'https://example.com',
      `
      <html><body>
        <form toolname="searchProducts" tooldescription="Search"
              data-read-only-hint="true" data-destructive-hint="false">
          <input type="text" name="q" />
        </form>
      </body></html>
    `,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('fails when declarative forms lack data annotations', () => {
    const page = mockPageContext(
      'https://example.com',
      `
      <html><body>
        <form toolname="searchProducts" tooldescription="Search">
          <input type="text" name="q" />
        </form>
      </body></html>
    `,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
  });

  it('ignores empty annotations object', () => {
    const manifest = JSON.stringify({
      tools: [{ name: 'searchProducts', description: 'Search', annotations: {} }],
    });
    const ctx = mockCheckContext([], {
      '/.well-known/webmcp': mockFetchResult(manifest, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
  });

  it('returns not-applicable when manifest has invalid JSON and no forms', () => {
    const ctx = mockCheckContext([], {
      '/.well-known/webmcp': mockFetchResult('invalid json {{{', 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('na');
  });

  it('skips non-object entries in manifest tools array', () => {
    const manifest = JSON.stringify({
      tools: [
        null,
        { name: 'searchProducts', description: 'Search', annotations: { readOnlyHint: true } },
      ],
    });
    const ctx = mockCheckContext([], {
      '/.well-known/webmcp': mockFetchResult(manifest, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('skips declarative form when tool name already seen in manifest', () => {
    const manifest = JSON.stringify({
      tools: [
        {
          name: 'searchProducts',
          description: 'Search',
          annotations: { readOnlyHint: true },
        },
      ],
    });
    const page = mockPageContext(
      'https://example.com',
      `<html><body>
        <form toolname="searchProducts" tooldescription="Search" data-read-only-hint="true">
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
    expect(result.message).toContain('All 1 tool(s)');
  });

  it('processes manifest tool with no name without adding to seen set', () => {
    const manifest = JSON.stringify({
      tools: [{ description: 'No name', annotations: { readOnlyHint: true } }],
    });
    const ctx = mockCheckContext([], {
      '/.well-known/webmcp': mockFetchResult(manifest, 200),
    });
    const result = audit.audit(ctx);
    // Tool counted but empty name not added to seen; annotation counted → pass
    expect(result.status).toBe('pass');
    expect(result.message).toContain('All 1 tool(s)');
  });

  it('counts form with empty toolname but does not add empty name to seen set', () => {
    const page = mockPageContext(
      'https://example.com',
      `<html><body>
        <form toolname="" tooldescription="A tool" data-read-only-hint="true">
          <input type="text" name="q" />
        </form>
      </body></html>`,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    // Form has annotation → pass
    expect(result.status).toBe('pass');
  });

  it('does not add annotation to annotationsFound when already present from another tool', () => {
    const manifest = JSON.stringify({
      tools: [{ name: 'searchProducts', description: 'Search', annotations: { readOnlyHint: true } }],
    });
    const page = mockPageContext(
      'https://example.com',
      `<html><body>
        <form toolname="addToCart" tooldescription="Add to cart" data-read-only-hint="false">
          <input type="text" name="id" />
        </form>
      </body></html>`,
    );
    const ctx = mockCheckContext([page], {
      '/.well-known/webmcp': mockFetchResult(manifest, 200),
    });
    const result = audit.audit(ctx);
    // Both tools have annotations; readOnlyHint counted only once in annotationsFound
    expect(result.status).toBe('pass');
    expect(result.message).toContain('All 2 tool(s)');
  });
});
