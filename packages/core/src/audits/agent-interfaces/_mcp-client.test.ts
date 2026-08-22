import { describe, it, expect, vi } from 'vitest';
import {
  discoverMcpEndpoint,
  rpcRequest,
  parseRpcResponse,
  postRpc,
  MCP_PROTOCOL_VERSION,
  MCP_ACCEPT,
} from './_mcp-client';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';
import type { CheckContext } from '../../check-context';
import type { FetchOptions, FetchResult } from '../../fetcher';

// isSafeUrl performs a real DNS lookup before the client POSTs to a URL it read
// out of a site-controlled root file. Stub it with an offline stand-in that
// still blocks loopback and private ranges, so the refusal test proves the gate
// rather than the mock.
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

function ctxWith(rootFiles: Record<string, string>): CheckContext {
  const files: Record<string, FetchResult> = {};
  for (const [path, body] of Object.entries(rootFiles)) {
    files[path] = mockFetchResult(body, 200, 'application/json');
  }
  return mockCheckContext([], files);
}

const SERVERS_JSON = JSON.stringify({ servers: [{ url: 'https://a.test/mcp' }] });
const UCP = JSON.stringify({
  services: { commerce: [{ transport: 'mcp', endpoint: 'https://a.test/ucp-mcp' }] },
});
const CATALOG = JSON.stringify({
  entries: [{ type: 'application/mcp-server-card+json', url: 'https://a.test/catalog-mcp' }],
});

describe('discoverMcpEndpoint', () => {
  it('reads the endpoint out of /.well-known/mcp/servers.json', () => {
    const found = discoverMcpEndpoint(ctxWith({ '/.well-known/mcp/servers.json': SERVERS_JSON }));
    expect(found).toEqual({ url: 'https://a.test/mcp', source: 'servers.json' });
  });

  it('reads an mcp-transport service out of /.well-known/ucp', () => {
    const found = discoverMcpEndpoint(ctxWith({ '/.well-known/ucp': UCP }));
    expect(found).toEqual({ url: 'https://a.test/ucp-mcp', source: 'ucp' });
  });

  it('reads an mcp-server-card entry out of /.well-known/ai-catalog.json', () => {
    const found = discoverMcpEndpoint(ctxWith({ '/.well-known/ai-catalog.json': CATALOG }));
    expect(found).toEqual({ url: 'https://a.test/catalog-mcp', source: 'ai-catalog' });
  });

  // servers.json is the MCP-native declaration, so it decides even when the
  // other two files also name an endpoint.
  it('prefers servers.json, then ucp, then the catalog', () => {
    const all = ctxWith({
      '/.well-known/mcp/servers.json': SERVERS_JSON,
      '/.well-known/ucp': UCP,
      '/.well-known/ai-catalog.json': CATALOG,
    });
    expect(discoverMcpEndpoint(all)?.source).toBe('servers.json');
    const twoLeft = ctxWith({
      '/.well-known/ucp': UCP,
      '/.well-known/ai-catalog.json': CATALOG,
    });
    expect(discoverMcpEndpoint(twoLeft)?.source).toBe('ucp');
  });

  it('returns undefined when no root file declares one', () => {
    expect(discoverMcpEndpoint(ctxWith({}))).toBeUndefined();
  });

  // A malformed declaration is not the same as no declaration: the site said it
  // has a server and got the shape wrong, which an audit must report.
  it('reports a servers.json with no servers array', () => {
    const found = discoverMcpEndpoint(
      ctxWith({ '/.well-known/mcp/servers.json': JSON.stringify({ mcp: [] }) }),
    );
    expect(found).toEqual({ url: '', source: 'no-array' });
  });

  it('reports a servers array with no usable url', () => {
    const found = discoverMcpEndpoint(
      ctxWith({ '/.well-known/mcp/servers.json': JSON.stringify({ servers: [{ name: 'x' }] }) }),
    );
    expect(found).toEqual({ url: '', source: 'no-url' });
  });
});

describe('rpcRequest', () => {
  it('frames a JSON-RPC 2.0 request with params', () => {
    expect(JSON.parse(rpcRequest(1, 'initialize', { protocolVersion: MCP_PROTOCOL_VERSION }))).toEqual({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: MCP_PROTOCOL_VERSION },
    });
  });

  it('omits params entirely when there are none', () => {
    expect(rpcRequest(2, 'tools/list')).toBe('{"jsonrpc":"2.0","id":2,"method":"tools/list"}');
  });

  it('pins the current MCP specification revision', () => {
    expect(MCP_PROTOCOL_VERSION).toBe('2026-07-28');
  });
});

describe('parseRpcResponse', () => {
  const json = (body: string) => mockFetchResult(body, 200, 'application/json');

  it('returns the result object of a successful response', () => {
    const out = parseRpcResponse(json('{"jsonrpc":"2.0","id":1,"result":{"tools":[]}}'));
    expect(out).toEqual({ ok: true, value: { tools: [] } });
  });

  it('returns the JSON-RPC error object when the server reports one', () => {
    const out = parseRpcResponse(
      json('{"jsonrpc":"2.0","id":1,"error":{"code":-32601,"message":"Method not found"}}'),
    );
    expect(out).toEqual({
      ok: false,
      error: { code: -32601, message: 'Method not found' },
      reason: 'JSON-RPC error -32601: Method not found',
    });
  });

  // Streamable HTTP may answer with an SSE stream. The final data frame carries
  // the response; earlier frames are progress notifications.
  it('reads the last data frame of an SSE stream', () => {
    const sse = mockFetchResult(
      'event: message\ndata: {"jsonrpc":"2.0","method":"notifications/progress"}\n\n' +
        'event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2026-07-28"}}\n\n',
      200,
      'text/event-stream',
    );
    expect(parseRpcResponse(sse)).toEqual({
      ok: true,
      value: { protocolVersion: '2026-07-28' },
    });
  });

  it('rejects a body that is not JSON', () => {
    const out = parseRpcResponse(mockFetchResult('<html>nope</html>', 200, 'text/html'));
    expect(out).toMatchObject({ ok: false });
    expect((out as { reason: string }).reason).toContain('not valid JSON-RPC');
  });

  it('rejects an empty body', () => {
    const out = parseRpcResponse(json(''));
    expect(out).toMatchObject({ ok: false, reason: 'empty response body' });
  });

  it('rejects a JSON object that is not JSON-RPC 2.0', () => {
    const out = parseRpcResponse(json('{"result":{"tools":[]}}'));
    expect(out).toMatchObject({ ok: false });
  });

  it('rejects a response whose result is not an object', () => {
    const out = parseRpcResponse(json('{"jsonrpc":"2.0","id":1,"result":"ok"}'));
    expect(out).toMatchObject({ ok: false });
  });
});

describe('postRpc', () => {
  function recorder(answer: FetchResult) {
    const seen: FetchOptions[] = [];
    const ctx = mockCheckContext([]);
    ctx.fetch = async (o: FetchOptions) => {
      seen.push(o);
      return answer;
    };
    return { seen, ctx };
  }

  it('POSTs the framed request with both Streamable HTTP Accept types', async () => {
    const r = recorder(mockFetchResult('{"jsonrpc":"2.0","id":1,"result":{}}', 200, 'application/json'));
    const out = await postRpc(r.ctx, 'https://a.test/mcp', 1, 'initialize', { capabilities: {} });
    expect(out).toEqual({ ok: true, value: {} });
    expect(r.seen[0]).toMatchObject({
      url: 'https://a.test/mcp',
      method: 'POST',
      acceptHeader: MCP_ACCEPT,
      contentType: 'application/json',
    });
    expect(JSON.parse(r.seen[0]!.body!)).toMatchObject({ method: 'initialize' });
  });

  it('refuses a loopback URL without fetching it', async () => {
    const r = recorder(mockFetchResult('{}', 200));
    const out = await postRpc(r.ctx, 'http://127.0.0.1/mcp', 1, 'initialize');
    expect(out).toMatchObject({ ok: false, reason: expect.stringContaining('refused') });
    expect(r.seen).toEqual([]);
  });

  it('reports a non-200 status rather than parsing the body', async () => {
    const r = recorder(mockFetchResult('nope', 503, 'text/html'));
    const out = await postRpc(r.ctx, 'https://a.test/mcp', 1, 'initialize');
    expect(out).toMatchObject({ ok: false, reason: 'HTTP 503' });
  });

  it('reports an unreachable endpoint rather than throwing', async () => {
    const ctx = mockCheckContext([]);
    ctx.fetch = async () => {
      throw new Error('socket hang up');
    };
    const out = await postRpc(ctx, 'https://a.test/mcp', 1, 'initialize');
    expect(out).toMatchObject({ ok: false, reason: 'unreachable' });
  });
});
