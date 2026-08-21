import { describe, it, expect } from 'vitest';
import { McpDiscoveryAudit } from './mcp-discovery';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

describe('McpDiscoveryAudit', () => {
  const audit = new McpDiscoveryAudit();

  it('passes when servers.json has a servers array', () => {
    const body = JSON.stringify({
      servers: [{ name: 'MCP', url: 'https://example.com/mcp', transport: 'streamable-http' }],
    });
    const ctx = mockCheckContext([], {
      '/.well-known/mcp/servers.json': mockFetchResult(body, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('1 server(s)');
  });

  it('fails when servers.json is missing', () => {
    const ctx = mockCheckContext([], {});
    expect(audit.audit(ctx).status).toBe('fail');
  });

  it('fails when servers.json returns 404', () => {
    const ctx = mockCheckContext([], {
      '/.well-known/mcp/servers.json': mockFetchResult('', 404),
    });
    expect(audit.audit(ctx).status).toBe('fail');
  });

  it('fails when servers.json is invalid JSON', () => {
    const ctx = mockCheckContext([], {
      '/.well-known/mcp/servers.json': mockFetchResult('nope {{{', 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('not valid JSON');
  });

  it('fails when there is no servers array', () => {
    const ctx = mockCheckContext([], {
      '/.well-known/mcp/servers.json': mockFetchResult(JSON.stringify({ name: 'x' }), 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('does not contain a servers array');
  });
});
