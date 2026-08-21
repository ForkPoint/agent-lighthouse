import { describe, it, expect } from 'vitest';
import { McpEndpointAudit } from './mcp-endpoint';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

function serversFile(url = 'https://example.com/mcp'): string {
  return JSON.stringify({ servers: [{ name: 'MCP', url }] });
}

describe('McpEndpointAudit', () => {
  const audit = new McpEndpointAudit();

  it('passes when the endpoint returns a valid JSON-RPC initialize result', async () => {
    const ctx = mockCheckContext([], {
      '/.well-known/mcp/servers.json': mockFetchResult(serversFile(), 200),
    });
    ctx.fetch = async () =>
      mockFetchResult(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: { protocolVersion: '2024-11-05', serverInfo: { name: 's', version: '1' } },
        }),
        200,
      );
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('valid JSON-RPC');
  });

  it('warns when the endpoint returns 200 but not valid JSON-RPC', async () => {
    const ctx = mockCheckContext([], {
      '/.well-known/mcp/servers.json': mockFetchResult(serversFile(), 200),
    });
    ctx.fetch = async () => mockFetchResult('<html>not json-rpc</html>', 200);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('not valid JSON-RPC');
  });

  it('fails when the endpoint returns a non-200 status', async () => {
    const ctx = mockCheckContext([], {
      '/.well-known/mcp/servers.json': mockFetchResult(serversFile(), 200),
    });
    ctx.fetch = async () => mockFetchResult('', 500);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('HTTP 500');
  });

  it('fails when the endpoint is unreachable', async () => {
    const ctx = mockCheckContext([], {
      '/.well-known/mcp/servers.json': mockFetchResult(serversFile(), 200),
    });
    ctx.fetch = async () => {
      throw new Error('network');
    };
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('not reachable');
  });

  it('fails when servers.json is missing', async () => {
    const ctx = mockCheckContext([], {});
    expect((await audit.audit(ctx)).status).toBe('fail');
  });

  it('fails when no server URL is present', async () => {
    const ctx = mockCheckContext([], {
      '/.well-known/mcp/servers.json': mockFetchResult(
        JSON.stringify({ servers: [{ name: 'no-url' }] }),
        200,
      ),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No server URL');
  });

  it('fails when servers.json has no servers array', async () => {
    const ctx = mockCheckContext([], {
      '/.well-known/mcp/servers.json': mockFetchResult(
        JSON.stringify({ name: 'test-server' }),
        200,
      ),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('no servers array');
  });
});
