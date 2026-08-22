import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';
import { isSafeUrl } from '../../fetcher';

function tryParseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

/**
 * The Streamable HTTP transport may answer a JSON-RPC request with an SSE
 * stream instead of a JSON body. Pull the `data:` payload out before parsing;
 * the old audit ran JSON.parse on the raw frame and reported a healthy server
 * as "HTTP 200 but response is not valid JSON-RPC".
 */
function parseRpcBody(body: string): unknown {
  const direct = tryParseJson(body);
  if (direct !== undefined) return direct;

  const payloads = [...body.matchAll(/^data:\s*(.*)$/gm)].map((m) => m[1]!.trim()).filter(Boolean);
  for (const payload of payloads) {
    const parsed = tryParseJson(payload);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

/** The `result` of a successful JSON-RPC 2.0 response, or undefined. */
function rpcResult(body: string): Record<string, unknown> | undefined {
  const parsed = parseRpcBody(body);
  if (!isObject(parsed)) return undefined;
  if (parsed['jsonrpc'] !== '2.0' || 'error' in parsed) return undefined;
  return isObject(parsed['result']) ? parsed['result'] : undefined;
}

// MCP's current specification revision. The old audit pinned 2024-11-05, which
// servers that reject unsupported versions answer with a JSON-RPC error.
const PROTOCOL_VERSION = '2026-07-28';
// Streamable HTTP requires both; the official TypeScript SDK transport answers
// 406 Not Acceptable when they are missing, which read as a broken server.
const MCP_ACCEPT = 'application/json, text/event-stream';

const CAPABILITY_KEYS = ['tools', 'resources', 'prompts'];

function rpcRequest(id: number, method: string, params?: unknown): string {
  return JSON.stringify({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) });
}

/**
 * Either a usable endpoint, or the reason the site's own declaration is
 * malformed — both come out of the same pass over the declared sources.
 */
type Endpoint =
  | { url: string; source: 'servers.json' | 'ucp' | 'ai-catalog' }
  | { url: ''; source: 'no-array' | 'no-url' };

/**
 * Where the site says its MCP server is. Every path here is an *explicit*
 * declaration; see the dossier for why `/mcp` is not probed speculatively.
 */
function discoverEndpoint(ctx: CheckContext): Endpoint | undefined {
  const servers = ctx.rootFiles['/.well-known/mcp/servers.json'];
  if (servers && servers.status === 200 && servers.body) {
    const parsed = tryParseJson(servers.body);
    if (!isObject(parsed) || !Array.isArray(parsed['servers'])) return { url: '', source: 'no-array' };
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

const EXPECTED =
  'A declared MCP endpoint answers a spec-compliant initialize handshake, negotiates capabilities, and annotates its tools';

const SAMPLE = `// Request (Streamable HTTP — both Accept types are required)
POST /mcp
Accept: application/json, text/event-stream
Content-Type: application/json

{"jsonrpc":"2.0","id":1,"method":"initialize","params":{
  "protocolVersion":"${PROTOCOL_VERSION}","capabilities":{},
  "clientInfo":{"name":"agent-lighthouse","version":"1.0.0"}}}

// Response — capabilities are negotiated here, not in a static file
{"jsonrpc":"2.0","id":1,"result":{
  "protocolVersion":"${PROTOCOL_VERSION}",
  "serverInfo":{"name":"your-server","version":"1.0.0"},
  "capabilities":{"tools":{},"resources":{}}}}

// tools/list — every tool should carry a boolean readOnlyHint
{"jsonrpc":"2.0","id":2,"result":{"tools":[
  {"name":"searchProducts","annotations":{"readOnlyHint":true}},
  {"name":"addToCart","annotations":{"readOnlyHint":false,"destructiveHint":false}}]}}`;

export class McpEndpointAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'agent-interfaces/mcp-endpoint',
    category: 'agent-interfaces',
    title: 'MCP endpoint functional',
    failureTitle: 'MCP endpoint functional',
    description:
      'One MCP endpoint audit: it finds the endpoint your site declares, speaks a spec-compliant JSON-RPC 2.0 initialize handshake to it, reports the capabilities the server negotiates on the wire, and checks that the tools it lists carry safety annotations.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/agent-interfaces/mcp-endpoint.md',
    defaultPriority: 'high',
    guidance: {
      impact:
        'If your MCP endpoint does not answer an initialize handshake, AI assistants cannot connect at all. Capabilities and tool annotations come off the same connection: without them an agent cannot tell whether your server offers tools, or which of them are destructive enough to need user confirmation.',
      fix: 'Declare your MCP endpoint somewhere machine-readable, make it answer a JSON-RPC 2.0 initialize request over Streamable HTTP, return your real capabilities in the initialize result, and give every tool returned by tools/list a boolean readOnlyHint annotation.',
      code: SAMPLE,
      effort: 'complex',
      docsUrl: 'https://modelcontextprotocol.io/specification/2026-07-28/server/discover',
      tags: ['mcp', 'endpoint', 'json-rpc', 'capabilities', 'annotations', 'agent-protocol'],
    },
  };

  private recommendation() {
    return {
      priority: 'high' as const,
      description: McpEndpointAudit.meta.description,
      code: SAMPLE,
    };
  }

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const endpoint = discoverEndpoint(ctx);

    if (!endpoint) {
      return this.fail(
        'No MCP endpoint is declared by this site (no servers.json, UCP service, or ai-catalog MCP entry).',
        EXPECTED,
        'No declared MCP endpoint',
        this.recommendation(),
      );
    }
    if (endpoint.source === 'no-array') {
      return this.fail(
        'servers.json has no servers array.',
        EXPECTED,
        'No servers array',
        this.recommendation(),
      );
    }
    if (endpoint.source === 'no-url') {
      return this.fail(
        'No server URL found in servers.json.',
        EXPECTED,
        'No server URL',
        this.recommendation(),
      );
    }

    const url = endpoint.url;
    // The URL comes out of a site-controlled file and we are about to POST to
    // it, which is SSRF-adjacent. Validate the target first.
    if (!(await isSafeUrl(url))) {
      return this.fail(
        `The declared MCP endpoint ${url} is not safe to probe (non-HTTP scheme or private address).`,
        EXPECTED,
        `${url} -> refused`,
        this.recommendation(),
      );
    }

    let response;
    try {
      response = await ctx.fetch({
        url,
        method: 'POST',
        acceptHeader: MCP_ACCEPT,
        contentType: 'application/json',
        body: rpcRequest(1, 'initialize', {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'agent-lighthouse', version: '1.0.0' },
        }),
      });
    } catch {
      return this.fail(
        `MCP endpoint at ${url} is not reachable.`,
        EXPECTED,
        `${url} -> unreachable`,
        this.recommendation(),
      );
    }

    // An OAuth-protected server answering an unauthenticated initialize with
    // 401 + WWW-Authenticate is behaving correctly, and is the norm for
    // anything non-public. That is a present server, not a broken one.
    if (response.status === 401 && response.headers?.['www-authenticate']) {
      return this.pass(
        `MCP endpoint at ${url} is present but authorization required (HTTP 401 with WWW-Authenticate).`,
        EXPECTED,
        `${url} -> HTTP 401, ${response.headers['www-authenticate']}`,
      );
    }

    if (response.status !== 200) {
      return this.fail(
        `MCP endpoint at ${url} returned HTTP ${response.status}.`,
        EXPECTED,
        `${url} -> HTTP ${response.status}`,
        this.recommendation(),
      );
    }

    const result = rpcResult(response.body);
    if (!result || typeof result['protocolVersion'] !== 'string') {
      return this.warn(
        `MCP endpoint at ${url} returned HTTP 200 but the response is not valid JSON-RPC.`,
        EXPECTED,
        `${url} -> HTTP 200, non-JSON-RPC response`,
        this.recommendation(),
      );
    }

    // Absorbed from mcp-capabilities (5.14): capabilities are protocol state
    // negotiated here, not a static file. A null/0/"" value is not a
    // declaration — the old audit counted anything that was not `false`.
    const negotiated = isObject(result['capabilities']) ? result['capabilities'] : {};
    const capabilities = CAPABILITY_KEYS.filter((key) => {
      const value = negotiated[key];
      return value !== undefined && value !== null && value !== false && value !== 0 && value !== '';
    });

    if (capabilities.length === 0) {
      return this.warn(
        `MCP endpoint at ${url} answered the initialize handshake but negotiated no capabilities (tools, resources or prompts).`,
        EXPECTED,
        `${url} -> HTTP 200, valid JSON-RPC, no capabilities`,
        this.recommendation(),
      );
    }

    const base = `${url} -> HTTP 200, valid JSON-RPC, capabilities: ${capabilities.join(', ')}`;
    if (!capabilities.includes('tools')) {
      return this.pass(
        `MCP endpoint at ${url} responded with valid JSON-RPC initialize result and negotiated ${capabilities.join(', ')}.`,
        EXPECTED,
        base,
      );
    }

    // Absorbed from webmcp-tool-annotations (5.24): read the real annotations
    // off a live tools/list response, and require a *boolean* readOnlyHint —
    // presence alone let `{"readOnlyHint": null}` claim safety metadata.
    let tools: unknown[] | undefined;
    try {
      const listed = await ctx.fetch({
        url,
        method: 'POST',
        acceptHeader: MCP_ACCEPT,
        contentType: 'application/json',
        body: rpcRequest(2, 'tools/list'),
      });
      if (listed.status === 200) {
        const listResult = rpcResult(listed.body);
        if (listResult && Array.isArray(listResult['tools'])) tools = listResult['tools'];
      }
    } catch {
      tools = undefined;
    }

    if (!tools) {
      return this.pass(
        `MCP endpoint at ${url} responded with valid JSON-RPC initialize result and negotiated ${capabilities.join(', ')}.`,
        EXPECTED,
        `${base}; tools/list not answered, annotations not assessed`,
      );
    }

    const annotated = tools.filter((tool) => {
      if (!isObject(tool)) return false;
      const annotations = tool['annotations'];
      return isObject(annotations) && typeof annotations['readOnlyHint'] === 'boolean';
    }).length;

    const coverage = `${annotated}/${tools.length} tools with a boolean readOnlyHint`;
    if (tools.length > 0 && annotated < tools.length) {
      return this.warn(
        `MCP endpoint at ${url} is functional, but ${tools.length - annotated} of its ${tools.length} tool(s) carry no boolean readOnlyHint annotation, so an agent cannot tell which are safe to invoke without confirmation.`,
        EXPECTED,
        `${base}; ${coverage}`,
        this.recommendation(),
      );
    }

    return this.pass(
      `MCP endpoint at ${url} responded with valid JSON-RPC initialize result, negotiated ${capabilities.join(', ')}, and annotates every listed tool.`,
      EXPECTED,
      `${base}; ${coverage}`,
    );
  }
}
