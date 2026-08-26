// Graduated from proposal 2026-08-22 (Plan 5, Task 26).
// Evidence dossier: docs/evidence/audits/agent-interfaces/mcp-modern-era-reachability.md
//
// Revision 2026-07-28 abolished the initialize handshake. One unauthenticated
// POST of server/discover therefore answers the only question that matters
// first: can a client built on the current revision use this server at all.
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';
import type { FetchResult } from '../../fetcher';
import {
  discoverMcpEndpoint,
  discoverProbe,
  mcpFetch,
  parseRpcResponse,
  postRpcRaw,
  sharedProbe,
  isObject,
  MCP_PROTOCOL_VERSION,
} from './_mcp-client';

/** The audit that owns the challenge this one can only report. */
const OAUTH_AUDIT = 'agent-interfaces/mcp-oauth-discovery-chain';
/** Revision that introduced the HTTP+SSE transport this audit condemns. */
const DEPRECATED_REVISION = '2024-11-05';
/** What a modern Streamable HTTP endpoint answers to GET and DELETE. */
const METHOD_NOT_ALLOWED = 405;

function versions(result: Record<string, unknown>): string[] {
  const raw = result['supportedVersions'];
  return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [];
}

/** The newest `YYYY-MM-DD` revision in a list, or undefined when there is none. */
function newest(list: string[]): string | undefined {
  return [...list].sort().pop();
}

function capabilityKeys(result: Record<string, unknown>): string[] {
  const caps = result['capabilities'];
  return isObject(caps) ? Object.keys(caps) : [];
}

function extensionIds(result: Record<string, unknown>): string[] {
  const caps = result['capabilities'];
  if (!isObject(caps)) return [];
  const ext = caps['extensions'];
  return isObject(ext) ? Object.keys(ext) : [];
}

function serverLabel(result: Record<string, unknown>): string {
  const info = result['serverInfo'];
  if (!isObject(info)) return 'no serverInfo';
  const name = typeof info['name'] === 'string' ? info['name'] : 'unnamed';
  const version = typeof info['version'] === 'string' ? ` ${info['version']}` : '';
  return `${name}${version}`;
}

/**
 * The 2024-11-05 transport opens with an SSE `endpoint` event naming a second
 * URL to POST to. Nothing in Streamable HTTP does that, so the event is a
 * reliable fingerprint of the deprecated transport.
 */
function isDeprecatedSse(res: FetchResult): boolean {
  if (res.status !== 200) return false;
  if (!res.contentType.includes('text/event-stream')) return false;
  const first = res.body.split(/\n\s*\n/)[0] ?? '';
  return /^event:\s*endpoint\s*$/m.test(first);
}

/** A body that tells the client to send `initialize` first. */
function demandsInitialize(res: FetchResult): boolean {
  return /initiali[sz]e/i.test(res.body);
}

const EXPECTED = `The declared MCP endpoint answers an unauthenticated server/discover POST carrying MCP-Protocol-Version: ${MCP_PROTOCOL_VERSION}, and lists that revision in result.supportedVersions`;

const SAMPLE = `POST /mcp HTTP/1.1
Content-Type: application/json
Accept: application/json, text/event-stream
MCP-Protocol-Version: ${MCP_PROTOCOL_VERSION}

{"jsonrpc":"2.0","id":"1","method":"server/discover","params":{"_meta":{
  "io.modelcontextprotocol/protocolVersion":"${MCP_PROTOCOL_VERSION}",
  "io.modelcontextprotocol/clientInfo":{"name":"acme-agent","version":"1.0.0"},
  "io.modelcontextprotocol/clientCapabilities":{}}}}

// 200 — the DiscoverResult is what a client reads before any consent prompt
{"jsonrpc":"2.0","id":"1","result":{
  "supportedVersions":["2025-11-25","${MCP_PROTOCOL_VERSION}"],
  "capabilities":{"tools":{},"resources":{}},
  "instructions":"Call searchProducts before addToCart.",
  "serverInfo":{"name":"acme-shop","version":"2.1.0"}}}

// GET and DELETE on the same path answer 405 — there is no session to resume
// and no stream to open in the current transport.`;

export class McpModernEraReachabilityAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'agent-interfaces/mcp-modern-era-reachability',
    category: 'agent-interfaces',
    title: 'Modern-Era Reachability Probe (server/discover)',
    failureTitle: 'Modern-Era Reachability Probe (server/discover)',
    description:
      "Determine, with one unauthenticated stateless POST, whether the site's MCP endpoint can be used at all by a client built on the current protocol revision (2026-07-28). Classifies the endpoint into modern / dual-era / legacy-only / deprecated-HTTP+SSE / unreachable, and extracts supportedVersions, capabilities, instructions and serverInfo from the DiscoverResult.",
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/agent-interfaces/mcp-modern-era-reachability.md',
    requires: ['origin-reachable'],
    defaultPriority: 'high',
    guidance: {
      impact:
        "Revision 2026-07-28 abolished the `initialize` handshake and protocol-level sessions: version, client identity and capabilities now travel as per-request `_meta`, and `server/discover` is a MUST-implement RPC. The spec's own compatibility matrix states verbatim that a Modern client against a Legacy server FAILS, with no fall-forward path. Therefore: if a single POST of `server/discover` carrying `_meta` + `MCP-Protocol-Version: 2026-07-28` does not yield either a DiscoverResult or a recognized modern JSON-RPC error, then every client that has moved to the current revision cannot invoke a single tool on this server — the failure is total, not degraded. Conversely a 404/-32601 on `server/discover` from a server that otherwise answers modern requests is a direct MUST violation that breaks pre-consent capability presentation.",
      fix: `Implement \`server/discover\` and answer it without authentication, returning \`supportedVersions\` that include ${MCP_PROTOCOL_VERSION}, your real \`capabilities\`, an \`instructions\` string and \`serverInfo\`. Read the protocol revision from the \`MCP-Protocol-Version\` header and from \`params._meta\`, and reject an unsupported one with JSON-RPC error -32022 carrying \`data.supported\`, rather than with a bare 400 or a demand for \`initialize\`. Retire the 2024-11-05 HTTP+SSE transport: a GET that opens a stream with an \`endpoint\` event has been deprecated since 2025-03-26. On a Streamable HTTP endpoint, GET and DELETE answer 405 and no \`Mcp-Session-Id\` is minted.`,
      code: SAMPLE,
      effort: 'moderate',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/agent-interfaces/mcp-modern-era-reachability/',
      tags: ['mcp', 'json-rpc', 'protocol-version', 'transport', 'agent-protocol'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const endpoint = discoverMcpEndpoint(ctx);
    if (!endpoint || !endpoint.url) {
      return this.notApplicable(
        'This site declares no MCP endpoint, so there is no server to probe. Declaring one is what agent-interfaces/mcp-endpoint scores.',
        EXPECTED,
        endpoint ? `Malformed declaration (${endpoint.source})` : 'No declared MCP endpoint',
      );
    }

    const url = endpoint.url;
    const where = `${url} (declared in ${endpoint.source})`;
    const discover = await discoverProbe(ctx, url);
    const get = await sharedProbe(ctx, `get|${url}`, () => mcpFetch(ctx, url, { method: 'GET' }));

    // The deprecated transport is diagnosed from the GET, whatever the POST did:
    // a server still speaking it cannot be reached by a modern client at all.
    if (get && isDeprecatedSse(get)) {
      return this.fail(
        `${url} answers GET with an SSE stream whose first event is \`endpoint\`, which is the ${DEPRECATED_REVISION} HTTP+SSE transport. It has been deprecated since 2025-03-26 and is eligible for removal, and a client on ${MCP_PROTOCOL_VERSION} cannot speak it.`,
        EXPECTED,
        `${where}; era=deprecated-HTTP+SSE`,
        'high',
      );
    }

    if (!discover) {
      return this.fail(
        `${url} did not answer a server/discover probe — the endpoint is unreachable, or it was refused before any request because it is not an HTTP(S) URL on a public address.`,
        EXPECTED,
        `${where}; era=unreachable`,
        'high',
      );
    }

    const challenge = discover.headers['www-authenticate'];
    if (discover.status === 401 && challenge) {
      return this.warn(
        `${url} answers server/discover with HTTP 401 and a \`WWW-Authenticate\` challenge, so its capabilities cannot be read before consent. That is legitimate for a private server; whether the challenge leads anywhere is scored by ${OAUTH_AUDIT}.`,
        EXPECTED,
        `${where}; era=auth-gated; challenge=${challenge.split(' ')[0] ?? 'Bearer'}`,
        'medium',
      );
    }

    const parsed = parseRpcResponse(discover);

    if (!parsed.ok && parsed.error?.code === -32022) {
      const data = isObject(parsed.error.data) ? parsed.error.data : {};
      const supported = Array.isArray(data['supported'])
        ? (data['supported'] as unknown[]).filter((v): v is string => typeof v === 'string')
        : [];
      const best = newest(supported);
      return this.warn(
        `${url} is a modern-era server on an older revision: it rejected ${MCP_PROTOCOL_VERSION} with JSON-RPC -32022 and supports ${supported.length > 0 ? supported.join(', ') : 'no revision it would name'}${best ? `, newest ${best}` : ''}. Clients on the current revision fail against it until it is upgraded.`,
        EXPECTED,
        `${where}; era=dual-era; newest supported ${best ?? 'unknown'}`,
        'medium',
      );
    }

    if (!parsed.ok && parsed.error?.code === -32601) {
      return this.fail(
        `${url} answers modern JSON-RPC but returns -32601 Method not found for server/discover. That is a MUST violation of ${MCP_PROTOCOL_VERSION}: a client cannot read capabilities, instructions or serverInfo before asking the user for consent.`,
        EXPECTED,
        `${where}; era=modern; server/discover missing`,
        'critical',
      );
    }

    if (!parsed.ok || discover.status !== 200) {
      // Nothing modern came back. Confirm the legacy era on the wire rather than
      // inferring it: a legacy server mints an Mcp-Session-Id on initialize.
      const legacy = await postRpcRaw(ctx, url, 1, 'initialize', {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'AgentLighthouse', version: '1.0.0' },
      });
      const session = legacy?.headers['mcp-session-id'];
      if (session) {
        return this.fail(
          `${url} is LEGACY-ONLY: it refused server/discover (HTTP ${discover.status}${demandsInitialize(discover) ? ', demanding `initialize` first' : ''}) and answered a 2025-03-26 \`initialize\` with an \`Mcp-Session-Id\` header. Every client on ${MCP_PROTOCOL_VERSION} fails against it, with no fall-forward path.`,
          EXPECTED,
          `${where}; era=legacy-only; Mcp-Session-Id minted`,
          'critical',
        );
      }
      return this.fail(
        `${url} answered neither a modern server/discover (HTTP ${discover.status}: ${parsed.ok ? 'unexpected status' : parsed.reason}) nor a legacy \`initialize\` handshake, so no MCP client of any era can use it.`,
        EXPECTED,
        `${where}; era=unusable`,
        'critical',
      );
    }

    // Modern era. Everything below reports what a client would read.
    const result = parsed.value;
    const declared = versions(result);
    const caps = capabilityKeys(result);
    const extensions = extensionIds(result);
    const hasInstructions = typeof result['instructions'] === 'string' && result['instructions'];
    const found = [
      where,
      'era=modern',
      `supportedVersions ${declared.length > 0 ? declared.join(', ') : 'absent'}`,
      `capabilities ${caps.length > 0 ? caps.join(', ') : 'none'}`,
      `extensions ${extensions.length > 0 ? extensions.join(', ') : 'none'}`,
      hasInstructions ? 'instructions present' : 'instructions absent',
      `serverInfo ${serverLabel(result)}`,
    ].join('; ');

    // Residue: a modern endpoint has no stream to open and no session to delete.
    const del = await sharedProbe(ctx, `delete|${url}`, () =>
      mcpFetch(ctx, url, { method: 'DELETE' }),
    );
    const residue: string[] = [];
    if (get && get.status !== METHOD_NOT_ALLOWED) {
      residue.push(`GET returns HTTP ${get.status} rather than ${METHOD_NOT_ALLOWED}`);
    }
    if (del && del.status !== METHOD_NOT_ALLOWED) {
      residue.push(`DELETE returns HTTP ${del.status} rather than ${METHOD_NOT_ALLOWED}`);
    }
    if (discover.headers['mcp-session-id']) {
      residue.push('server/discover mints an `Mcp-Session-Id`, and the modern revision has no sessions');
    }

    if (declared.length === 0) {
      return this.warn(
        `${url} answers server/discover but its result carries no \`supportedVersions\`, so a client cannot tell which revisions it accepts without probing.`,
        EXPECTED,
        found,
        'medium',
      );
    }

    if (!declared.includes(MCP_PROTOCOL_VERSION)) {
      return this.warn(
        `${url} answers server/discover but lists ${declared.join(', ')} without ${MCP_PROTOCOL_VERSION}, so clients on the current revision are not admitted.`,
        EXPECTED,
        found,
        'medium',
      );
    }

    if (residue.length > 0) {
      return this.warn(
        `${url} is a modern ${MCP_PROTOCOL_VERSION} server, with legacy residue: ${residue.join('; ')}. Residue is not fatal, but it keeps a transport alive that the current revision does not define.`,
        EXPECTED,
        `${found}; residue: ${residue.length}`,
        'low',
      );
    }

    return this.pass(
      `${url} is reachable by a current client: it answers server/discover with ${MCP_PROTOCOL_VERSION} in supportedVersions, ${caps.length} capability group(s)${extensions.length > 0 ? ` and ${extensions.length} extension(s)` : ''}, and no legacy residue.`,
      EXPECTED,
      found,
    );
  }
}
