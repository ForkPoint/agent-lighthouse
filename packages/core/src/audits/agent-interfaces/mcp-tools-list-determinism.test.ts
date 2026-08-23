import { describe, it, expect, vi } from 'vitest';
import { McpToolsListDeterminismAudit } from './mcp-tools-list-determinism';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';
import { expectNotApplicableOnEmpty } from '../../tests/na-contract';
import type { CheckContext } from '../../check-context';
import type { FetchOptions, FetchResult } from '../../fetcher';

// isSafeUrl resolves DNS before the client POSTs to a URL read out of a
// site-controlled root file. Offline stand-in, still blocking private ranges.
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

const ENDPOINT = 'https://api.example.com/mcp';

function servers(): Record<string, FetchResult> {
  return {
    '/.well-known/mcp/servers.json': mockFetchResult(
      JSON.stringify({ servers: [{ url: ENDPOINT }] }),
      200,
      'application/json',
    ),
  };
}

const TOOL_A = { name: 'searchProducts', inputSchema: { type: 'object', properties: {} } };
const TOOL_B = { name: 'addToCart', inputSchema: { type: 'object', properties: {} } };

type Result = { status: string; message: string; found: string };

/**
 * Run the audit against a per-call result builder. `build(callIndex)` returns
 * the JSON-RPC result object for that call, so a test can vary the answer the
 * way a non-deterministic server would.
 */
function run(
  build: (call: number) => Record<string, unknown>,
  discover?: FetchResult,
): Promise<Result> {
  const ctx: CheckContext = mockCheckContext([], servers());
  let call = -1;
  ctx.fetch = async (o: FetchOptions) => {
    const body = JSON.parse(o.body ?? '{}') as { method?: string };
    if (body.method === 'server/discover') return discover ?? mockFetchResult('{}', 404);
    if (body.method !== 'tools/list') return mockFetchResult('{}', 404);
    call += 1;
    return mockFetchResult(
      JSON.stringify({ jsonrpc: '2.0', id: 1, result: build(call) }),
      200,
      'application/json',
    );
  };
  return new McpToolsListDeterminismAudit().audit(ctx) as Promise<Result>;
}

/** A well-formed, deterministic result. */
function healthy(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { tools: [TOOL_A, TOOL_B], resultType: 'complete', ttlMs: 60_000, cacheScope: 'private', ...extra };
}

describe('McpToolsListDeterminismAudit', () => {
  const audit = new McpToolsListDeterminismAudit();

  it('is notApplicable on an empty site', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it('is notApplicable when the site declares no MCP endpoint', async () => {
    const ctx: CheckContext = mockCheckContext([]);
    const result = (await audit.audit(ctx)) as Result;
    expect(result.status).toBe('na');
  });

  it('is notApplicable when the server lists no tools', async () => {
    const result = await run(() => ({ tools: [], ttlMs: 1000, cacheScope: 'public' }));
    expect(result.status).toBe('na');
  });

  it('passes a deterministic list and reports the ttl', async () => {
    const result = await run(() => healthy());
    expect(result.status).toBe('pass');
    expect(result.found).toContain('ttlMs 60000');
    expect(result.found).toContain('cacheScope private');
  });

  it('fails when ttlMs is absent', async () => {
    const result = await run(() => ({ tools: [TOOL_A], cacheScope: 'private' }));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('ttlMs');
  });

  it('fails ttlMs: 0 because no caching is possible', async () => {
    const result = await run(() => healthy({ ttlMs: 0 }));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('stale on arrival');
  });

  it('fails when cacheScope is absent', async () => {
    const result = await run(() => ({ tools: [TOOL_A], ttlMs: 60_000 }));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('cacheScope');
  });

  it('fails a cacheScope outside public and private', async () => {
    const result = await run(() => healthy({ cacheScope: 'shared' }));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('"shared"');
  });

  it('warns on cacheScope public when the endpoint also issues a 401 challenge', async () => {
    const challenge = mockFetchResult('', 401, 'text/plain');
    challenge.headers['www-authenticate'] = 'Bearer';
    const result = await run(() => healthy({ cacheScope: 'public' }), challenge);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('shared across access tokens');
  });

  it('warns when the same tools come back in a different order', async () => {
    const result = await run((call) => healthy({ tools: call === 2 ? [TOOL_B, TOOL_A] : [TOOL_A, TOOL_B] }));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('different order');
  });

  it('warns when the definitions change while order holds', async () => {
    const result = await run((call) =>
      healthy({
        tools: [
          call === 1 ? { ...TOOL_A, description: 'generated at 12:01' } : TOOL_A,
          TOOL_B,
        ],
      }),
    );
    expect(result.status).toBe('warn');
    expect(result.message).toContain('prompt caching');
  });

  // Same content, different key order: JCS hides it, the raw hash does not.
  it('warns when only the serialization key order churns', async () => {
    const result = await run((call) =>
      healthy({
        tools: [
          call === 1
            ? { inputSchema: TOOL_A.inputSchema, name: TOOL_A.name }
            : { name: TOOL_A.name, inputSchema: TOOL_A.inputSchema },
          TOOL_B,
        ],
      }),
    );
    expect(result.status).toBe('warn');
    expect(result.message).toContain('key order');
  });

  // The timed version of this probe would prove a MUST violation; this one
  // cannot, and says so.
  it('warns on a differing tool set and states the timing deviation', async () => {
    const result = await run((call) => healthy({ tools: call === 2 ? [TOOL_A] : [TOOL_A, TOOL_B] }));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('MUST NOT vary per connection');
    expect(result.message).toContain('back to back');
  });

  it('fails when a later page omits ttlMs', async () => {
    const ctx: CheckContext = mockCheckContext([], servers());
    ctx.fetch = async (o: FetchOptions) => {
      const body = JSON.parse(o.body ?? '{}') as { method?: string; params?: { cursor?: string } };
      if (body.method !== 'tools/list') return mockFetchResult('{}', 404);
      const result = body.params?.cursor
        ? { tools: [TOOL_B], resultType: 'complete', cacheScope: 'private' }
        : { tools: [TOOL_A], resultType: 'complete', ttlMs: 60_000, cacheScope: 'private', nextCursor: 'p2' };
      return mockFetchResult(
        JSON.stringify({ jsonrpc: '2.0', id: 1, result }),
        200,
        'application/json',
      );
    };
    const result = (await audit.audit(ctx)) as Result;
    expect(result.status).toBe('fail');
    expect(result.message).toContain('page 2');
  });

  it('fails when cacheScope differs across the pages of one request', async () => {
    const ctx: CheckContext = mockCheckContext([], servers());
    ctx.fetch = async (o: FetchOptions) => {
      const body = JSON.parse(o.body ?? '{}') as { method?: string; params?: { cursor?: string } };
      if (body.method !== 'tools/list') return mockFetchResult('{}', 404);
      const result = body.params?.cursor
        ? { tools: [TOOL_B], resultType: 'complete', ttlMs: 60_000, cacheScope: 'public' }
        : { tools: [TOOL_A], resultType: 'complete', ttlMs: 60_000, cacheScope: 'private', nextCursor: 'p2' };
      return mockFetchResult(
        JSON.stringify({ jsonrpc: '2.0', id: 1, result }),
        200,
        'application/json',
      );
    };
    const result = (await audit.audit(ctx)) as Result;
    expect(result.status).toBe('fail');
    expect(result.message).toContain('differs across the pages');
  });

  it('reads the hints out of _meta when they are not at the result root', async () => {
    const result = await run(() => ({
      tools: [TOOL_A],
      _meta: { resultType: 'complete', ttlMs: 30_000, cacheScope: 'private' },
    }));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('ttlMs 30000');
  });
});
