import { randomBytes } from 'node:crypto';
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';
import { isSafeUrl } from '../../url-utils';
import {
  discoverMcpEndpoint,
  discoverProbe,
  postRpcRaw,
  mcpFetch,
  sharedProbe,
  discoverParams,
  MCP_PROTOCOL_VERSION,
} from '../../gatherers/mcp';

/** A domain that cannot belong to anyone: `.example` is reserved by RFC 2606. */
function throwawayOrigin(): string {
  return `https://al-probe-${randomBytes(6).toString('hex')}.example`;
}

/** The headers a browser client would ask to send on a preflight. */
const PREFLIGHT_HEADERS = 'content-type, mcp-protocol-version, authorization';

export class McpOriginValidationCorsAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'agent-interfaces/mcp-origin-validation-cors',
    category: 'agent-interfaces',
    title: 'The MCP endpoint validates Origin and its CORS policy matches its auth posture',
    failureTitle: 'This MCP endpoint’s CORS policy exposes it to any page the user visits',
    description:
      'Sends the discover call twice — once with a throwaway `Origin`, once without — and one CORS preflight, then compares. An endpoint that reflects an arbitrary Origin into `Access-Control-Allow-Origin` while also allowing credentials has authorized every page the user visits to call it on the user’s behalf. Permissive CORS on an endpoint with no auth surface is reported and not scored.',
    scoreDisplayMode: 'ternary',
    tier: 'scored',
    evidenceGrade: 'B',
    weight: weightForGrade('B', 'scored'),
    defaultPriority: 'high',
    dossier: 'docs/evidence/audits/agent-interfaces/mcp-origin-validation-cors.md',
    requires: ['origin-reachable'],
    guidance: {
      impact:
        'The transport spec is unambiguous: servers MUST validate the Origin header on all incoming connections, and answer 403 when it is present and invalid, because a server that does not is reachable from any web page the user has open. The provable defect is the CORS pairing: an endpoint that reflects the requesting Origin into `Access-Control-Allow-Origin` and returns `Access-Control-Allow-Credentials: true` has authorized any page to enumerate its tool surface and invoke tools with the user’s session.',
      fix: 'Validate `Origin` on every request and answer 403 when it is present and not one you allow. Never reflect an arbitrary Origin while allowing credentials: return a fixed allow-list, or drop `Access-Control-Allow-Credentials`. `Access-Control-Allow-Origin: *` is only safe on an endpoint that accepts no credentials at all.',
      effort: 'moderate',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/agent-interfaces/mcp-origin-validation-cors/',
      tags: ['mcp', 'cors', 'dns-rebinding', 'security'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const endpoint = discoverMcpEndpoint(ctx);
    if (!endpoint || !endpoint.url) {
      return this.notApplicable(
        'This site declares no MCP endpoint, so there is no Origin policy to probe.',
        'A declared MCP endpoint answering the discover call',
        endpoint ? `Malformed declaration (${endpoint.source})` : 'No declared MCP endpoint',
      );
    }

    const url = endpoint.url;
    const origin = throwawayOrigin();

    const baseline = await discoverProbe(ctx, url);
    if (!baseline) {
      return this.notApplicable(
        `${url} did not answer, so its Origin policy could not be probed. Whether the endpoint answers at all is scored by agent-interfaces/mcp-modern-era-reachability.`,
        'A declared MCP endpoint answering the discover call',
        `${url} did not answer`,
      );
    }

    const withOrigin = await sharedProbe(ctx, `discover-origin|${url}`, () =>
      postRpcRaw(ctx, url, 'al-origin', 'server/discover', discoverParams(), {
        'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
        Origin: origin,
      }),
    );

    const preflight = (await isSafeUrl(url))
      ? await mcpFetch(ctx, url, {
          method: 'OPTIONS',
          headers: {
            Origin: origin,
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': PREFLIGHT_HEADERS,
          },
        })
      : undefined;

    const cors = preflight?.headers ?? withOrigin?.headers ?? {};
    const allowOrigin = (cors['access-control-allow-origin'] ?? '').trim();
    const allowCredentials = (cors['access-control-allow-credentials'] ?? '').trim().toLowerCase() === 'true';
    const allowHeaders = (cors['access-control-allow-headers'] ?? '').toLowerCase();
    const admitsAuthorization = allowHeaders.includes('authorization') || allowHeaders.includes('*');
    const challenged = baseline.status === 401 && baseline.headers['www-authenticate'] !== undefined;
    const credentialAccepting = challenged || admitsAuthorization;

    const reflected = allowOrigin === origin;
    const wildcard = allowOrigin === '*';
    const differentiates = withOrigin !== undefined && withOrigin.status !== baseline.status;

    const findings: string[] = [];
    const notes: string[] = [];

    if (reflected && allowCredentials) {
      findings.push(
        `${url} reflects an arbitrary Origin (${origin}) into Access-Control-Allow-Origin and returns Access-Control-Allow-Credentials: true, so any page the user visits can call this endpoint with their session`,
      );
    } else if (wildcard && credentialAccepting) {
      findings.push(
        `${url} answers Access-Control-Allow-Origin: * on an endpoint that ${challenged ? 'issues an authentication challenge' : 'admits an Authorization header'}`,
      );
    }

    if (!differentiates && credentialAccepting && findings.length === 0) {
      findings.push(
        `${url} answers a request carrying a throwaway Origin exactly as it answers one with no Origin, so it applies no Origin policy — the transport spec makes that validation a MUST`,
      );
    }

    if (!credentialAccepting && (wildcard || reflected)) {
      notes.push(
        `${url} allows any Origin, but presents no authentication surface, so there is no session for a page to borrow. Reported, not scored.`,
      );
    }
    if (!differentiates && !credentialAccepting) {
      notes.push(`${url} applies no Origin differentiation, on an endpoint with no authentication surface`);
    }
    const buffering = (preflight?.headers['x-accel-buffering'] ?? withOrigin?.headers['x-accel-buffering'] ?? '').trim();
    if (buffering !== '') notes.push(`X-Accel-Buffering: ${buffering}`);

    const details = {
      endpoint: url,
      allowOrigin,
      allowCredentials,
      allowHeaders: allowHeaders.slice(0, 200),
      originDifferentiates: differentiates,
      credentialAccepting,
      preflightStatus: preflight?.status ?? 0,
      findings: findings.slice(0, 10),
      notes: notes.slice(0, 10),
    };
    const expected =
      'The endpoint validates Origin, and never pairs a reflected or wildcard Access-Control-Allow-Origin with credentials';
    const found = `Baseline ${baseline.status}, with-Origin ${withOrigin?.status ?? 'no answer'}, preflight ${preflight?.status ?? 'no answer'}; Access-Control-Allow-Origin "${allowOrigin || 'absent'}", credentials ${allowCredentials}.`;
    const displayValue = reflected && allowCredentials ? 'Reflected origin + credentials' : allowOrigin || 'no CORS headers';

    if (findings.length > 0) {
      const critical = reflected && allowCredentials;
      const result = critical || wildcard ? this.fail(findings[0]!, expected, found,
        'Validate Origin and answer 403 when it is not one you allow; never pair a reflected Origin with Access-Control-Allow-Credentials.',
      ) : this.warn(findings[0]!, expected, found,
        'Validate the Origin header on every incoming connection, as the transport spec requires.',
      );
      return { ...result, displayValue, details };
    }

    return {
      ...this.pass(
        `${url} does not expose a credentialed CORS surface to an arbitrary Origin.`,
        expected,
        found,
      ),
      displayValue,
      details,
    };
  }
}
