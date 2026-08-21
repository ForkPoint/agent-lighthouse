import { describe, it, expect } from 'vitest';
import { WebmcpManifestAudit } from './webmcp-registered-tools';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

describe('WebmcpManifestAudit', () => {
  const audit = new WebmcpManifestAudit();

  it('passes when manifest exists with tools', () => {
    const manifest = JSON.stringify({
      name: 'Test Store',
      tools: [{ name: 'searchProducts', description: 'Search products' }],
    });
    const ctx = mockCheckContext([], {
      '/.well-known/webmcp': mockFetchResult(manifest, 200, 'application/json'),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('1 valid tool(s)');
  });

  it('passes with multiple tools', () => {
    const manifest = JSON.stringify({
      tools: [
        { name: 'searchProducts', description: 'Search' },
        { name: 'addToCart', description: 'Add to cart' },
        { name: 'checkout', description: 'Checkout' },
      ],
    });
    const ctx = mockCheckContext([], {
      '/.well-known/webmcp': mockFetchResult(manifest, 200, 'application/json'),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('3 valid tool(s)');
  });

  it('fails when manifest is missing (404)', () => {
    const ctx = mockCheckContext([], {
      '/.well-known/webmcp': mockFetchResult('', 404),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
  });

  it('fails when manifest is not fetched at all', () => {
    const ctx = mockCheckContext([], {});
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
  });

  it('fails when manifest is invalid JSON', () => {
    const ctx = mockCheckContext([], {
      '/.well-known/webmcp': mockFetchResult('not json {{{', 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('not valid JSON');
  });

  it('fails when manifest has no tools array', () => {
    const ctx = mockCheckContext([], {
      '/.well-known/webmcp': mockFetchResult(JSON.stringify({ name: 'Store' }), 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('does not contain a tools array');
  });

  it('fails when tools array is empty', () => {
    const ctx = mockCheckContext([], {
      '/.well-known/webmcp': mockFetchResult(JSON.stringify({ tools: [] }), 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('empty tools array');
  });

  it('fails when tools array has entries but none are valid tool objects with a name', () => {
    const ctx = mockCheckContext([], {
      '/.well-known/webmcp': mockFetchResult(
        JSON.stringify({ tools: [null, 42, { description: 'no name field' }] }),
        200,
      ),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('none are valid tool objects');
  });
});
