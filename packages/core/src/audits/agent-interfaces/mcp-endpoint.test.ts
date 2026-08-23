import { describe, it, expect, vi } from 'vitest';
import { McpEndpointAudit } from './mcp-endpoint';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';
import type { FetchOptions, FetchResult } from '../../fetcher';

// isSafeUrl performs a real DNS lookup before the audit POSTs to the declared
// endpoint. Stub it with an offline stand-in that still blocks loopback and
// private ranges, so the refusal test below proves the gate rather than the mock.
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

function serversFile(url = 'https://example.com/mcp'): string {
  return JSON.stringify({ servers: [{ name: 'MCP', url }] });
}

function initializeResult(capabilities?: Record<string, unknown>): string {
  return JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    result: {
      protocolVersion: '2026-07-28',
      serverInfo: { name: 's', version: '1' },
      ...(capabilities ? { capabilities } : {}),
    },
  });
}

function toolsListResult(tools: unknown[]): string {
  return JSON.stringify({ jsonrpc: '2.0', id: 2, result: { tools } });
}

/** Route by JSON-RPC method so a test can answer initialize and tools/list differently. */
function rpcRouter(
  handlers: { initialize: () => FetchResult; toolsList?: () => FetchResult },
): (options: FetchOptions) => Promise<FetchResult> {
  return async (options) => {
    const method = options.body?.includes('"tools/list"') ? 'tools/list' : 'initialize';
    if (method === 'tools/list') {
      return handlers.toolsList ? handlers.toolsList() : mockFetchResult('', 404);
    }
    return handlers.initialize();
  };
}

const ctxWithServers = (url?: string) =>
  mockCheckContext([], { '/.well-known/mcp/servers.json': mockFetchResult(serversFile(url), 200) });

describe('McpEndpointAudit', () => {
  const audit = new McpEndpointAudit();

  // ── the handshake itself ────────────────────────────────────

  it('passes when the endpoint returns a valid JSON-RPC initialize result', async () => {
    const ctx = ctxWithServers();
    ctx.fetch = rpcRouter({
      initialize: () => mockFetchResult(initializeResult({ resources: {} }), 200),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('valid JSON-RPC');
  });

  it('sends a spec-compliant Accept header and a current protocolVersion', async () => {
    const ctx = ctxWithServers();
    let seen: FetchOptions | undefined;
    ctx.fetch = async (options) => {
      seen ??= options;
      return mockFetchResult(initializeResult(), 200);
    };
    await audit.audit(ctx);
    expect(seen!.acceptHeader).toBe('application/json, text/event-stream');
    expect(seen!.body).not.toContain('2024-11-05');
  });

  it('unwraps an SSE-framed initialize response', async () => {
    const ctx = ctxWithServers();
    ctx.fetch = rpcRouter({
      initialize: () =>
        mockFetchResult(
          `event: message\ndata: ${initializeResult({ resources: {} })}\n\n`,
          200,
          'text/event-stream',
        ),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('treats 401 with WWW-Authenticate as a present, authorization-protected server', async () => {
    const ctx = ctxWithServers();
    ctx.fetch = async () => {
      const r = mockFetchResult('', 401);
      r.headers['www-authenticate'] = 'Bearer resource_metadata="https://example.com/.well-known"';
      return r;
    };
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('authorization required');
  });

  it('still fails on a bare 401 with no WWW-Authenticate challenge', async () => {
    const ctx = ctxWithServers();
    ctx.fetch = async () => mockFetchResult('', 401);
    expect((await audit.audit(ctx)).status).toBe('fail');
  });

  it('refuses to POST to a private-network endpoint', async () => {
    const ctx = ctxWithServers('http://127.0.0.1:8080/mcp');
    let called = false;
    ctx.fetch = async () => {
      called = true;
      return mockFetchResult(initializeResult(), 200);
    };
    const result = await audit.audit(ctx);
    expect(called).toBe(false);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('not safe to probe');
  });

  it('warns when the endpoint returns 200 but not valid JSON-RPC', async () => {
    const ctx = ctxWithServers();
    ctx.fetch = async () => mockFetchResult('<html>not json-rpc</html>', 200);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('not valid JSON-RPC');
  });

  it('fails when the endpoint returns a non-200 status', async () => {
    const ctx = ctxWithServers();
    ctx.fetch = async () => mockFetchResult('', 500);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('HTTP 500');
  });

  it('fails when the endpoint is unreachable', async () => {
    const ctx = ctxWithServers();
    ctx.fetch = async () => {
      throw new Error('network');
    };
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('not reachable');
  });

  // ── endpoint discovery ──────────────────────────────────────

  it('fails when no endpoint is declared anywhere', async () => {
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
      '/.well-known/mcp/servers.json': mockFetchResult(JSON.stringify({ name: 'x' }), 200),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('no servers array');
  });

  it('discovers an MCP endpoint declared in the ai-catalog', async () => {
    const ctx = mockCheckContext([], {
      '/.well-known/ai-catalog.json': mockFetchResult(
        JSON.stringify({
          specVersion: '1.0',
          entries: [
            { type: 'application/mcp-server-card+json', url: 'https://example.com/mcp' },
          ],
        }),
        200,
        'application/ai-catalog+json',
      ),
    });
    ctx.fetch = rpcRouter({
      initialize: () => mockFetchResult(initializeResult({ resources: {} }), 200),
    });
    expect((await audit.audit(ctx)).status).toBe('pass');
  });

  // ── absorbed mcp-capabilities (5.14): capabilities off the wire ──

  it('reports the capabilities negotiated in the initialize response', async () => {
    const ctx = ctxWithServers();
    ctx.fetch = rpcRouter({
      initialize: () => mockFetchResult(initializeResult({ tools: {}, resources: {} }), 200),
      toolsList: () => mockFetchResult(toolsListResult([]), 200),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.found).toContain('tools');
    expect(result.found).toContain('resources');
  });

  it('warns when a reachable server negotiates no capabilities at all', async () => {
    const ctx = ctxWithServers();
    ctx.fetch = rpcRouter({ initialize: () => mockFetchResult(initializeResult({}), 200) });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('no capabilities');
  });

  it('does not count a null capability value as declared', async () => {
    const ctx = ctxWithServers();
    ctx.fetch = rpcRouter({
      initialize: () => mockFetchResult(initializeResult({ tools: null }), 200),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('no capabilities');
  });

  // ── absorbed webmcp-tool-annotations (5.24): annotations off tools/list ──

  it('passes when every listed tool carries a boolean readOnlyHint', async () => {
    const ctx = ctxWithServers();
    ctx.fetch = rpcRouter({
      initialize: () => mockFetchResult(initializeResult({ tools: {} }), 200),
      toolsList: () =>
        mockFetchResult(
          toolsListResult([
            { name: 'search', annotations: { readOnlyHint: true } },
            { name: 'addToCart', annotations: { readOnlyHint: false, destructiveHint: false } },
          ]),
          200,
        ),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.found).toContain('2/2');
  });

  it('warns when only some tools carry a readOnlyHint', async () => {
    const ctx = ctxWithServers();
    ctx.fetch = rpcRouter({
      initialize: () => mockFetchResult(initializeResult({ tools: {} }), 200),
      toolsList: () =>
        mockFetchResult(
          toolsListResult([
            { name: 'search', annotations: { readOnlyHint: true } },
            { name: 'deleteAccount' },
          ]),
          200,
        ),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('readOnlyHint');
  });

  it('rejects a non-boolean readOnlyHint rather than counting its presence', async () => {
    const ctx = ctxWithServers();
    ctx.fetch = rpcRouter({
      initialize: () => mockFetchResult(initializeResult({ tools: {} }), 200),
      toolsList: () =>
        mockFetchResult(toolsListResult([{ name: 'search', annotations: { readOnlyHint: null } }]), 200),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.found).toContain('0/1');
  });

  it('does not punish a server whose tools/list call fails', async () => {
    const ctx = ctxWithServers();
    ctx.fetch = rpcRouter({
      initialize: () => mockFetchResult(initializeResult({ tools: {} }), 200),
      toolsList: () => mockFetchResult('', 500),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.found).toContain('tools/list not answered');
  });

  it('does not call tools/list when the server declares no tools capability', async () => {
    const ctx = ctxWithServers();
    let toolsListCalls = 0;
    ctx.fetch = async (options) => {
      if (options.body?.includes('"tools/list"')) toolsListCalls++;
      return mockFetchResult(initializeResult({ resources: {} }), 200);
    };
    const result = await audit.audit(ctx);
    expect(toolsListCalls).toBe(0);
    expect(result.status).toBe('pass');
  });
});
