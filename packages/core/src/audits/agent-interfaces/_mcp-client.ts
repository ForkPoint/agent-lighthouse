import type { CheckContext } from '../../check-context';
import type { FetchResult } from '../../fetcher';
import { isSafeUrl } from '../../fetcher';

/**
 * MCP's current specification revision. Pinning an older one makes servers that
 * reject unsupported versions answer with a JSON-RPC error, which reads as a
 * broken server when it is a stale client.
 */
export const MCP_PROTOCOL_VERSION = '2026-07-28';

/**
 * Streamable HTTP requires both media types. The official TypeScript SDK
 * transport answers 406 Not Acceptable when either is missing.
 */
export const MCP_ACCEPT = 'application/json, text/event-stream';

export function tryParseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

export function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

/**
 * Either a usable endpoint, or the reason the site's own declaration is
 * malformed — both come out of the same pass over the declared sources. A
 * malformed declaration is not the same as no declaration: the site said it has
 * a server and got the shape wrong, and an audit must be able to say so.
 */
export type McpEndpoint =
  | { url: string; source: 'servers.json' | 'ucp' | 'ai-catalog' }
  | { url: ''; source: 'no-array' | 'no-url' };

/**
 * Where the site says its MCP server is. Every path here is an *explicit*
 * declaration; see the mcp-endpoint dossier for why `/mcp` is not probed
 * speculatively.
 */
export function discoverMcpEndpoint(ctx: CheckContext): McpEndpoint | undefined {
  const servers = ctx.rootFiles['/.well-known/mcp/servers.json'];
  if (servers && servers.status === 200 && servers.body) {
    const parsed = tryParseJson(servers.body);
    if (!isObject(parsed) || !Array.isArray(parsed['servers']))
      return { url: '', source: 'no-array' };
    const entry = (parsed['servers'] as unknown[]).find(
      (s) => isObject(s) && typeof s['url'] === 'string' && s['url'],
    );
    if (!entry) return { url: '', source: 'no-url' };
    return { url: (entry as Record<string, unknown>)['url'] as string, source: 'servers.json' };
  }

  const ucp = ctx.rootFiles['/.well-known/ucp'];
  if (ucp && ucp.status === 200 && ucp.body) {
    const parsed = tryParseJson(ucp.body);
    if (isObject(parsed)) {
      const root = (parsed['ucp'] ?? parsed) as Record<string, unknown>;
      const services = (parsed['services'] ?? root['services']) as
        | Record<string, unknown>
        | undefined;
      if (isObject(services)) {
        for (const list of Object.values(services)) {
          if (!Array.isArray(list)) continue;
          for (const svc of list) {
            if (isObject(svc) && svc['transport'] === 'mcp' && typeof svc['endpoint'] === 'string') {
              return { url: svc['endpoint'], source: 'ucp' };
            }
          }
        }
      }
    }
  }

  // An MCP server card declared in the AI catalog is an explicit declaration
  // too, and it is the one the mcp-endpoint evidence recommends detecting.
  const catalog = ctx.rootFiles['/.well-known/ai-catalog.json'];
  if (catalog && catalog.status === 200 && catalog.body) {
    const parsed = tryParseJson(catalog.body);
    if (isObject(parsed) && Array.isArray(parsed['entries'])) {
      for (const entry of parsed['entries'] as unknown[]) {
        if (!isObject(entry)) continue;
        const type = typeof entry['type'] === 'string' ? entry['type'] : '';
        if (type.includes('mcp-server-card') && typeof entry['url'] === 'string') {
          return { url: entry['url'], source: 'ai-catalog' };
        }
      }
    }
  }

  return undefined;
}

/** Frame a JSON-RPC 2.0 request. `params` is omitted entirely when absent. */
export function rpcRequest(id: number | string, method: string, params?: unknown): string {
  return JSON.stringify({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) });
}

export type RpcOutcome =
  | { ok: true; value: Record<string, unknown> }
  | {
      ok: false;
      error?: { code: number; message: string; data?: unknown };
      reason: string;
    };

/**
 * Pull the JSON-RPC payload out of a response body.
 *
 * The Streamable HTTP transport may answer with `text/event-stream` instead of
 * a JSON body. In a stream the response is the frame carrying `result` or
 * `error`; the frames around it are progress notifications, so the last such
 * frame wins rather than the first parseable one.
 */
function rpcPayload(body: string): unknown {
  const direct = tryParseJson(body);
  if (direct !== undefined) return direct;

  const frames = [...body.matchAll(/^data:\s*(.*)$/gm)]
    .map((m) => tryParseJson(m[1]!.trim()))
    .filter((v) => v !== undefined);
  if (frames.length === 0) return undefined;
  for (let i = frames.length - 1; i >= 0; i -= 1) {
    const frame = frames[i];
    if (isObject(frame) && ('result' in frame || 'error' in frame)) return frame;
  }
  return frames[frames.length - 1];
}

/** Read a JSON-RPC 2.0 response out of a fetch result, JSON or SSE. */
export function parseRpcResponse(result: FetchResult): RpcOutcome {
  if (!result.body || !result.body.trim()) {
    return { ok: false, reason: 'empty response body' };
  }
  const parsed = rpcPayload(result.body);
  if (!isObject(parsed) || parsed['jsonrpc'] !== '2.0') {
    return { ok: false, reason: 'response is not valid JSON-RPC' };
  }
  const error = parsed['error'];
  if (isObject(error)) {
    const code = typeof error['code'] === 'number' ? error['code'] : 0;
    const message = typeof error['message'] === 'string' ? error['message'] : 'unknown error';
    return {
      ok: false,
      error: { code, message, ...(error['data'] !== undefined ? { data: error['data'] } : {}) },
      reason: `JSON-RPC error ${code}: ${message}`,
    };
  }
  if ('error' in parsed) {
    return { ok: false, reason: 'response is not valid JSON-RPC' };
  }
  const value = parsed['result'];
  if (!isObject(value)) {
    return { ok: false, reason: 'response carries no result object' };
  }
  return { ok: true, value };
}

/**
 * POST one JSON-RPC call to a declared MCP endpoint.
 *
 * The URL comes out of a site-controlled root file and we are about to POST to
 * it, which is SSRF-adjacent — hence the `isSafeUrl` gate before any request.
 */
export async function postRpc(
  ctx: CheckContext,
  url: string,
  id: number | string,
  method: string,
  params?: unknown,
  headers?: Record<string, string>,
): Promise<RpcOutcome> {
  if (!(await isSafeUrl(url))) {
    return { ok: false, reason: `${url} refused (non-HTTP scheme or private address)` };
  }
  let response: FetchResult;
  try {
    response = await ctx.fetch({
      url,
      method: 'POST',
      acceptHeader: MCP_ACCEPT,
      contentType: 'application/json',
      body: rpcRequest(id, method, params),
      ...(headers ? { headers } : {}),
    });
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
  if (response.status !== 200) {
    return { ok: false, reason: `HTTP ${response.status}` };
  }
  return parseRpcResponse(response);
}

/**
 * One request to a declared MCP endpoint, returning the whole response.
 *
 * `postRpc` above answers the question "did the call succeed", which is all the
 * initialize handshake needs. The protocol-conformance audits need the opposite:
 * the status line, the response headers and the error body *are* the evidence —
 * a 400 carrying `-32022`, a 401 carrying `WWW-Authenticate`, a GET that fails
 * to answer 405. Returns undefined when the URL is refused or the socket is not
 * answered, so a caller can tell "no answer" from "an answer we did not like".
 */
export async function mcpFetch(
  ctx: CheckContext,
  url: string,
  init: {
    method?: 'GET' | 'POST' | 'DELETE';
    body?: string;
    headers?: Record<string, string>;
    signal?: AbortSignal;
  } = {},
): Promise<FetchResult | undefined> {
  if (!(await isSafeUrl(url))) return undefined;
  try {
    return await ctx.fetch({
      url,
      method: init.method ?? 'POST',
      acceptHeader: MCP_ACCEPT,
      ...(init.method === undefined || init.method === 'POST'
        ? { contentType: 'application/json' }
        : {}),
      ...(init.body !== undefined ? { body: init.body } : {}),
      ...(init.headers ? { headers: init.headers } : {}),
      ...(init.signal ? { signal: init.signal } : {}),
    });
  } catch {
    return undefined;
  }
}

/** Frame and POST one JSON-RPC call, returning the whole response. */
export function postRpcRaw(
  ctx: CheckContext,
  url: string,
  id: number | string,
  method: string,
  params?: unknown,
  headers?: Record<string, string>,
): Promise<FetchResult | undefined> {
  return mcpFetch(ctx, url, {
    method: 'POST',
    body: rpcRequest(id, method, params),
    ...(headers ? { headers } : {}),
  });
}

/**
 * The five protocol audits probe the same endpoint in the same scan, and three
 * of them want the same `server/discover` response. Memoise per scan, keyed on
 * the CheckContext object so two concurrent scans never share a probe.
 *
 * Deliberately opt-in: `mcp-tools-list-determinism` must issue its three
 * `tools/list` calls for real, and a cache would answer them from one response
 * and make every determinism assertion vacuously true.
 */
const probeCache = new WeakMap<object, Map<string, Promise<FetchResult | undefined>>>();

export function sharedProbe(
  ctx: CheckContext,
  key: string,
  run: () => Promise<FetchResult | undefined>,
): Promise<FetchResult | undefined> {
  let byKey = probeCache.get(ctx);
  if (!byKey) {
    byKey = new Map();
    probeCache.set(ctx, byKey);
  }
  const hit = byKey.get(key);
  if (hit) return hit;
  const pending = run();
  byKey.set(key, pending);
  return pending;
}

/**
 * The modern-era `server/discover` probe, shared by the reachability, OAuth and
 * downgrade audits: one POST carrying the current revision in both the header
 * and `_meta`, exactly as a current client sends it.
 */
export function discoverProbe(ctx: CheckContext, url: string): Promise<FetchResult | undefined> {
  return sharedProbe(ctx, `discover|${url}`, () =>
    postRpcRaw(ctx, url, 'al-1', 'server/discover', discoverParams(), {
      'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
    }),
  );
}

/** The `_meta` block a modern client carries on every request. */
export function discoverParams(version: string = MCP_PROTOCOL_VERSION): Record<string, unknown> {
  return {
    _meta: {
      'io.modelcontextprotocol/protocolVersion': version,
      'io.modelcontextprotocol/clientInfo': { name: 'AgentLighthouse', version: '1.0.0' },
      'io.modelcontextprotocol/clientCapabilities': {},
    },
  };
}
