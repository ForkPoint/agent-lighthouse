import { describe, it, expect } from 'vitest';
import { McpCapabilitiesAudit } from './mcp-capabilities';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

describe('McpCapabilitiesAudit', () => {
  const audit = new McpCapabilitiesAudit();

  it('passes when a server declares capabilities via nested object', () => {
    const body = JSON.stringify({
      servers: [
        { name: 'MCP', url: 'https://example.com/mcp', capabilities: { tools: true, prompts: false } },
      ],
    });
    const ctx = mockCheckContext([], {
      '/.well-known/mcp/servers.json': mockFetchResult(body, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('tools');
    expect(result.message).not.toContain('prompts');
  });

  it('passes when capabilities are declared as top-level server keys', () => {
    const body = JSON.stringify({
      servers: [{ name: 'MCP', url: 'https://example.com/mcp', resources: true }],
    });
    const ctx = mockCheckContext([], {
      '/.well-known/mcp/servers.json': mockFetchResult(body, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('resources');
  });

  it('fails when no capabilities are declared', () => {
    const body = JSON.stringify({
      servers: [{ name: 'MCP', url: 'https://example.com/mcp' }],
    });
    const ctx = mockCheckContext([], {
      '/.well-known/mcp/servers.json': mockFetchResult(body, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No MCP capabilities');
  });

  it('fails when servers.json is missing', () => {
    const ctx = mockCheckContext([], {});
    expect(audit.audit(ctx).status).toBe('fail');
  });

  it('fails when there is no servers array', () => {
    const ctx = mockCheckContext([], {
      '/.well-known/mcp/servers.json': mockFetchResult(JSON.stringify({ name: 'x' }), 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('no servers array');
  });

  it('fails when servers.json contains invalid JSON', () => {
    const ctx = mockCheckContext([], {
      '/.well-known/mcp/servers.json': mockFetchResult('invalid json {{{', 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('no servers array');
  });

  it('skips non-object server entries in the servers array', () => {
    const body = JSON.stringify({
      servers: [null, { name: 'MCP', url: 'https://example.com/mcp', capabilities: { tools: true } }],
    });
    const ctx = mockCheckContext([], {
      '/.well-known/mcp/servers.json': mockFetchResult(body, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('tools');
  });

  it('skips number server entries (covers typeof branch of isObject)', () => {
    const body = JSON.stringify({
      servers: [42, { name: 'MCP', url: 'https://example.com/mcp', capabilities: { tools: true } }],
    });
    const ctx = mockCheckContext([], {
      '/.well-known/mcp/servers.json': mockFetchResult(body, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('tools');
  });

  it('skips array server entries (covers Array.isArray branch of isObject)', () => {
    const body = JSON.stringify({
      servers: [['tool'], { name: 'MCP', url: 'https://example.com/mcp', capabilities: { tools: true } }],
    });
    const ctx = mockCheckContext([], {
      '/.well-known/mcp/servers.json': mockFetchResult(body, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('tools');
  });
});
