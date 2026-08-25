// Graduated from proposal 2026-08-22 (Plan 5, Task 27).
// Evidence dossier: docs/evidence/audits/agent-interfaces/mcp-oauth-discovery-chain.md
//
// The whole chain is credential-free: 401 challenge, WWW-Authenticate
// resource_metadata, the PRM document, then the authorization server metadata.
// It stops before any token request, so it needs nothing but public documents —
// and every gate it checks is one a conforming client applies before it will
// even show the user a consent prompt.
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';
import type { FetchResult } from '../../fetcher';
import { isSafeUrl } from '../../fetcher';
import { discoverMcpEndpoint, discoverProbe, tryParseJson, isObject } from './_mcp-client';

/** How many authorization servers are probed. */
const MAX_AS = 2;
/** Scope values that grant everything and name nothing. */
const OMNIBUS_SCOPES = ['*', 'all', 'full-access'];
/** RFC 9728 §3 well-known prefix. */
const PRM_WELL_KNOWN = '/.well-known/oauth-protected-resource';

/**
 * Literal addresses no authorization server may live on. A host that merely
 * resolves into one of these ranges is stopped by `isSafeUrl`; a literal is
 * caught here so the audit can say *why* rather than reporting a fetch that
 * never happened.
 */
const PRIVATE_HOST =
  /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|\[?::1\]?|\[?f[cd][0-9a-f]{2}:.*|\[?fe[89ab][0-9a-f]:.*)$/i;

/** Lowercase scheme and host, no fragment, no trailing slash. */
function canonical(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, '');
    return `${u.protocol.toLowerCase()}//${u.host.toLowerCase()}${path}${u.search}`;
  } catch {
    return url;
  }
}

/** The RFC 9728 §3 fallback URLs, in the order a client tries them. */
function prmFallbacks(url: string): string[] {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, '');
    const origin = `${u.protocol}//${u.host}`;
    return path && path !== '/'
      ? [`${origin}${PRM_WELL_KNOWN}${path}`, `${origin}${PRM_WELL_KNOWN}`]
      : [`${origin}${PRM_WELL_KNOWN}`];
  } catch {
    return [];
  }
}

/** The AS metadata URLs, in the order RFC 8414 and MCP mandate. */
function asWellKnown(issuer: string): string[] {
  try {
    const u = new URL(issuer);
    const path = u.pathname.replace(/\/$/, '');
    const origin = `${u.protocol}//${u.host}`;
    if (path && path !== '/') {
      return [
        `${origin}/.well-known/oauth-authorization-server${path}`,
        `${origin}/.well-known/openid-configuration${path}`,
        `${origin}${path}/.well-known/openid-configuration`,
      ];
    }
    return [
      `${origin}/.well-known/oauth-authorization-server`,
      `${origin}/.well-known/openid-configuration`,
    ];
  } catch {
    return [];
  }
}

interface JsonDoc {
  url: string;
  value: Record<string, unknown>;
}

/** GET one public metadata document. Every URL here comes from site data. */
async function getJson(ctx: CheckContext, url: string): Promise<JsonDoc | undefined> {
  if (!(await isSafeUrl(url))) return undefined;
  let res: FetchResult;
  try {
    res = await ctx.fetch({ url, acceptHeader: 'application/json' });
  } catch {
    return undefined;
  }
  if (res.status !== 200) return undefined;
  const parsed = tryParseJson(res.body);
  return isObject(parsed) ? { url, value: parsed } : undefined;
}

async function firstJson(ctx: CheckContext, urls: string[]): Promise<JsonDoc | undefined> {
  for (const url of urls) {
    const doc = await getJson(ctx, url);
    if (doc) return doc;
  }
  return undefined;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

const EXPECTED =
  "A 401 from the MCP endpoint carries a Bearer WWW-Authenticate with resource_metadata, the Protected Resource Metadata document's `resource` is string-identical to the canonical server URI, and every `authorization_servers` entry is a public https issuer whose metadata document echoes that same issuer";

const SAMPLE = `HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="https://api.example.com/.well-known/oauth-protected-resource/mcp", scope="mcp:tools"

// GET https://api.example.com/.well-known/oauth-protected-resource/mcp
{
  "resource": "https://api.example.com/mcp",
  "resource_name": "Acme MCP",
  "authorization_servers": ["https://auth.example.com"],
  "scopes_supported": ["mcp:tools", "mcp:resources"],
  "bearer_methods_supported": ["header"]
}

// GET https://auth.example.com/.well-known/oauth-authorization-server
{
  "issuer": "https://auth.example.com",
  "authorization_endpoint": "https://auth.example.com/authorize",
  "token_endpoint": "https://auth.example.com/token",
  "code_challenge_methods_supported": ["S256"],
  "authorization_response_iss_parameter_supported": true
}`;

export class McpOauthDiscoveryChainAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'agent-interfaces/mcp-oauth-discovery-chain',
    category: 'agent-interfaces',
    title: 'OAuth Discovery Chain Integrity (RFC 9728 → RFC 8414)',
    failureTitle: 'OAuth Discovery Chain Integrity (RFC 9728 → RFC 8414)',
    description:
      'Walks the full credential-free authorization discovery path an MCP client must traverse — 401 challenge, WWW-Authenticate resource_metadata, Protected Resource Metadata document, authorization server metadata — and asserts every MUST-level validation gate the client will apply. Ends before any token is requested, so it needs no credentials.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/agent-interfaces/mcp-oauth-discovery-chain.md',
    defaultPriority: 'high',
    guidance: {
      impact:
        "The spec makes RFC 9728 mandatory for MCP servers and makes clients apply two hard identity checks: RFC 9728 §3.3 requires the PRM's `resource` value to be string-identical to the resource identifier used to construct the request URL, and the MCP AS-discovery rules require the fetched AS metadata's `issuer` to be string-identical to the issuer used to construct the well-known URL — on either mismatch the client MUST NOT use the metadata. MCP additionally strengthens RFC 9728 by requiring `authorization_servers` to carry at least one entry (it is merely OPTIONAL in the RFC). Each of these is a silent, total blocker: the discovery chain either resolves end to end or the agent never reaches an authorization prompt, so a single character of drift between the deployed endpoint URL and the `resource` claim makes the server unusable to every conforming client while the server's own logs show nothing but 401s.",
      fix: 'Answer an unauthenticated request with 401 and a `WWW-Authenticate: Bearer` header carrying `resource_metadata="…"`, so the client does not have to guess. Publish the PRM at that URL with `resource` set to the exact canonical server URI — same scheme, same host case, same path, no trailing slash — and with `authorization_servers` holding at least one public https issuer. Give the PRM a `resource_name` and a `scopes_supported` list of named, least-privilege scopes; do not advertise `offline_access`, and never advertise `*`, `all` or `full-access`. At the authorization server, publish RFC 8414 metadata whose `issuer` is string-identical to the issuer string in the PRM, advertise `S256` in `code_challenge_methods_supported`, and set `authorization_response_iss_parameter_supported` to true.',
      code: SAMPLE,
      effort: 'complex',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/agent-interfaces/mcp-oauth-discovery-chain/',
      tags: ['mcp', 'oauth', 'rfc-9728', 'rfc-8414', 'authorization', 'agent-protocol'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const endpoint = discoverMcpEndpoint(ctx);
    if (!endpoint || !endpoint.url) {
      return this.notApplicable(
        'This site declares no MCP endpoint, so there is no authorization chain to walk.',
        EXPECTED,
        endpoint ? `Malformed declaration (${endpoint.source})` : 'No declared MCP endpoint',
      );
    }

    const url = endpoint.url;
    const server = canonical(url);
    const discover = await discoverProbe(ctx, url);
    if (!discover) {
      return this.notApplicable(
        `${url} did not answer at all, so no challenge and no metadata can be read. Reachability is scored by agent-interfaces/mcp-modern-era-reachability.`,
        EXPECTED,
        `${url}; endpoint unreachable`,
      );
    }

    const musts: string[] = [];
    const shoulds: string[] = [];
    const notes: string[] = [];

    // Step 1 — the challenge.
    const challenge = discover.headers['www-authenticate'] ?? '';
    const advertised = /resource_metadata\s*=\s*"([^"]+)"/i.exec(challenge)?.[1];
    if (discover.status === 401) {
      const scheme = (challenge.trim().split(/[\s,]/)[0] ?? '').toLowerCase();
      if (scheme !== 'bearer') {
        musts.push(
          `the 401 carries \`WWW-Authenticate: ${challenge.trim() || '(absent)'}\` rather than the \`Bearer\` scheme RFC 9728 requires`,
        );
      }
      if (!advertised) {
        notes.push(
          'the 401 challenge carries no `resource_metadata` parameter, so a client must fall back to probing the RFC 9728 §3 well-known paths',
        );
      }
      const scope = /(?:^|[\s,])scope\s*=\s*"([^"]+)"/i.exec(challenge)?.[1];
      if (scope) notes.push(`the challenge advertises scope "${scope}"`);
    } else if (discover.status === 200) {
      notes.push(
        'the endpoint answers an unauthenticated server/discover with 200, so capabilities can be presented before consent',
      );
    }

    // Step 2/3 — the PRM, from the advertised URL first, then the mandated order.
    const candidates = [...(advertised ? [advertised] : []), ...prmFallbacks(url)];
    const prm = await firstJson(ctx, candidates);

    if (!prm) {
      if (discover.status === 401) {
        return this.fail(
          `${url} challenges for authorization but publishes no Protected Resource Metadata: ${candidates.join(', ')} answered nothing usable. A client has no way to learn which authorization server to use, so it stops here.`,
          EXPECTED,
          `${server}; challenge without PRM; ${candidates.length} URL(s) probed`,
          'critical',
        );
      }
      return this.notApplicable(
        `${url} answers unauthenticated and publishes no Protected Resource Metadata, so there is no authorization chain to walk. That is a legitimate posture for a fully public server.`,
        EXPECTED,
        `${server}; open endpoint (HTTP ${discover.status}); no PRM`,
      );
    }

    // Step 3 — the identity gate a client applies before it will use the PRM.
    const resource = typeof prm.value['resource'] === 'string' ? prm.value['resource'] : undefined;
    if (!resource) {
      musts.push('the PRM carries no `resource` value, which RFC 9728 requires');
    } else if (resource !== server) {
      musts.push(
        `the PRM's \`resource\` is "${resource}" but the canonical server URI is "${server}" — RFC 9728 §3.3 makes a client reject metadata on any character of drift`,
      );
    }

    const servers = strings(prm.value['authorization_servers']);
    const rawServers = prm.value['authorization_servers'];
    if (!Array.isArray(rawServers) || servers.length === 0) {
      musts.push(
        'the PRM carries no non-empty `authorization_servers` array, which MCP requires even though RFC 9728 leaves it optional',
      );
    }

    for (const issuer of servers) {
      let host = '';
      try {
        const parsed = new URL(issuer);
        host = parsed.hostname;
        if (parsed.protocol !== 'https:') {
          musts.push(`authorization server "${issuer}" is not an https URL`);
          continue;
        }
      } catch {
        musts.push(`authorization server "${issuer}" is not an absolute URL`);
        continue;
      }
      if (PRIVATE_HOST.test(host)) {
        musts.push(
          `authorization server "${issuer}" is on a private, loopback or link-local address, which no client outside your network can reach`,
        );
      }
    }

    if (typeof prm.value['resource_name'] !== 'string' || !prm.value['resource_name']) {
      shoulds.push('the PRM carries no `resource_name`, so a consent prompt has nothing to name');
    }

    const scopes = strings(prm.value['scopes_supported']);
    if (!Array.isArray(prm.value['scopes_supported'])) {
      shoulds.push('the PRM carries no `scopes_supported`, which RFC 9728 recommends');
    } else {
      if (scopes.some((s) => s.toLowerCase() === 'offline_access')) {
        shoulds.push(
          '`scopes_supported` advertises `offline_access`, which the MCP authorization spec says SHOULD NOT be requested',
        );
      }
      const omnibus = scopes.filter((s) => OMNIBUS_SCOPES.includes(s.toLowerCase()));
      if (omnibus.length > 0) {
        shoulds.push(
          `\`scopes_supported\` advertises the omnibus scope ${omnibus.map((s) => `"${s}"`).join(', ')}, which grants everything and names nothing`,
        );
      }
    }

    // Step 5 — the authorization servers themselves.
    let probed = 0;
    for (const issuer of servers.slice(0, MAX_AS)) {
      const urls = asWellKnown(issuer);
      if (urls.length === 0) continue;
      const doc = await firstJson(ctx, urls);
      if (!doc) {
        musts.push(
          `authorization server "${issuer}" publishes no metadata at ${urls.join(' or ')}, so the chain ends before the client can start an authorization request`,
        );
        continue;
      }
      probed += 1;
      const declared = doc.value['issuer'];
      if (declared !== issuer) {
        musts.push(
          `authorization server metadata at ${doc.url} declares \`issuer\` "${String(declared)}" but was reached as "${issuer}" — a client MUST NOT use metadata whose issuer is not string-identical`,
        );
      }
      for (const key of ['authorization_endpoint', 'token_endpoint'] as const) {
        if (typeof doc.value[key] !== 'string') {
          musts.push(`authorization server "${issuer}" declares no \`${key}\``);
        }
      }
      const methods = strings(doc.value['code_challenge_methods_supported']);
      if (!methods.includes('S256')) {
        shoulds.push(
          `authorization server "${issuer}" does not advertise \`S256\` in \`code_challenge_methods_supported\`, and MCP clients use PKCE with S256`,
        );
      }
      if (doc.value['authorization_response_iss_parameter_supported'] !== true) {
        shoulds.push(
          `authorization server "${issuer}" does not advertise \`authorization_response_iss_parameter_supported\` (RFC 9207), which defends against mix-up attacks`,
        );
      }
    }

    const found = [
      server,
      `challenge ${discover.status === 401 ? (advertised ? 'with resource_metadata' : 'without resource_metadata') : `absent (HTTP ${discover.status})`}`,
      `PRM ${prm.url}`,
      `authorization_servers ${servers.length}`,
      `AS metadata read ${probed}`,
      `scopes ${scopes.length > 0 ? scopes.join(', ') : 'none declared'}`,
    ].join('; ');

    const tail = notes.length > 0 ? ` Also: ${notes.join('; ')}.` : '';

    if (musts.length > 0) {
      return this.fail(`The chain breaks: ${musts.join('; ')}.${tail}`, EXPECTED, found, 'critical');
    }
    if (shoulds.length > 0) {
      return this.warn(
        `The chain resolves end to end, with review items: ${shoulds.join('; ')}.${tail}`,
        EXPECTED,
        found,
        'medium',
      );
    }
    return this.pass(
      `The authorization discovery chain resolves end to end: challenge, PRM at ${prm.url} whose \`resource\` matches ${server}, and ${probed} authorization server(s) whose metadata echoes the issuer.${tail}`,
      EXPECTED,
      found,
    );
  }
}
