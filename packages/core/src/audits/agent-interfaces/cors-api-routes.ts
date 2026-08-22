// Redemption rewrite landed 2026-08-22 (Plan 4, Task 16). The audit probed a
// hardcoded `${baseUrl}/api/` with OPTIONS and failed the site at `high`
// priority when no ACAO came back — about routes that, on an API living at
// `/v1`, `/graphql` or `api.example.com`, do not exist. It gated that probe on
// an OpenAPI spec existing, then discarded the spec's contents, even though
// `servers[].url` and the `paths` list are the authoritative answer to "where
// are the API routes". One arm of the gate, `/swagger.json`, is not in the
// orchestrator's `rootFilePaths` at all, so it was dead code that silently
// mis-gated any site publishing only that file. Absence of a spec returned
// `warn`, so every ordinary content site lost half a point on an API check that
// did not apply to it.
// Evidence dossier: docs/evidence/audits/agent-interfaces/cors-api-routes.md
//
// The framing was wrong too. GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot,
// Claude-User, PerplexityBot, every server-side agent backend and every MCP
// client are non-browser HTTP clients: they do not implement the same-origin
// policy and a missing ACAO does not affect them at all. The genuine consumer
// class is browser-sandboxed agent code — an OpenAI Apps SDK widget in an
// isolated iframe under a strict CSP — which is small today, growing, and the
// only thing this audit now claims.
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';
import { type FetchResult, isSafeUrl } from '../../fetcher';

/** How many endpoints to probe. Two is enough to tell a policy from an accident. */
const MAX_TARGETS = 2;

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

/** Strip the parameters off a media type: `application/json; charset=utf-8`. */
function mediaType(contentType: string | undefined): string {
  return (contentType ?? '').split(';')[0]!.trim().toLowerCase();
}

/** A 200 that is not an HTML soft-404 — the rule every well-known probe needs. */
function servedAsData(result: FetchResult | undefined): result is FetchResult {
  return (
    !!result &&
    result.status === 200 &&
    !!result.body.trim() &&
    mediaType(result.contentType) !== 'text/html'
  );
}

/**
 * The published OpenAPI document, or undefined.
 *
 * JSON only: resolving `servers[].url` out of YAML would need a YAML parser,
 * and guessing at it with regexes is exactly the kind of sniffing this rewrite
 * removes. A YAML-only site is `na` rather than probed at a guessed path.
 */
function readSpec(ctx: CheckContext): Record<string, unknown> | undefined {
  const result = ctx.rootFiles['/openapi.json'];
  if (!servedAsData(result)) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(result.body);
  } catch {
    return undefined;
  }
  if (!isObject(parsed)) return undefined;
  const versioned = typeof parsed['openapi'] === 'string' || typeof parsed['swagger'] === 'string';
  if (!versioned || !isObject(parsed['paths'])) return undefined;
  return parsed;
}

/**
 * Expand a `servers[].url` template using the declared variable defaults, which
 * OpenAPI requires each variable to carry. A template left unresolved is
 * dropped rather than probed with braces in the URL.
 */
function expandServerUrl(entry: Record<string, unknown>): string | undefined {
  let url = typeof entry['url'] === 'string' ? entry['url'] : '';
  if (!url) return undefined;
  const variables = isObject(entry['variables']) ? entry['variables'] : {};
  url = url.replace(/\{([^{}]+)\}/g, (whole, name: string) => {
    const variable = variables[name];
    const fallback = isObject(variable) ? variable['default'] : undefined;
    return typeof fallback === 'string' ? fallback : whole;
  });
  return url.includes('{') ? undefined : url;
}

/**
 * The endpoints the spec itself says exist: each declared server crossed with
 * the concrete (non-templated) paths, capped. Templated paths are skipped
 * because a `{id}` probe would 404 on a working API and read as missing CORS.
 */
function resolveTargets(ctx: CheckContext, spec: Record<string, unknown>): string[] {
  const servers = Array.isArray(spec['servers']) ? (spec['servers'] as unknown[]) : [];
  // OpenAPI: "If the servers property is not provided … the default value would
  // be a Server Object with a url value of /."
  const bases = servers.filter(isObject).map(expandServerUrl).filter((u): u is string => !!u);
  if (bases.length === 0) bases.push('/');

  const paths = isObject(spec['paths']) ? Object.keys(spec['paths']) : [];
  const concrete = paths.filter((p) => !p.includes('{'));

  const targets: string[] = [];
  for (const base of bases) {
    let baseUrl: URL;
    try {
      baseUrl = new URL(base, ctx.baseUrl);
    } catch {
      continue;
    }
    const suffixes = concrete.length > 0 ? concrete.slice(0, MAX_TARGETS) : [''];
    for (const suffix of suffixes) {
      // Join without letting a leading slash on the path discard the server's
      // own base path: `/v1` + `/products` must be `/v1/products`.
      const joined = suffix
        ? `${baseUrl.pathname.replace(/\/$/, '')}/${suffix.replace(/^\//, '')}`
        : baseUrl.pathname;
      const url = new URL(baseUrl.toString());
      url.pathname = joined;
      if (!targets.includes(url.toString())) targets.push(url.toString());
      if (targets.length >= MAX_TARGETS) return targets;
    }
  }
  return targets;
}

type Probe =
  | { kind: 'acao'; url: string; value: string }
  | { kind: 'none'; url: string }
  | { kind: 'refused'; url: string }
  | { kind: 'error'; url: string };

async function probe(ctx: CheckContext, url: string): Promise<Probe> {
  // The URL comes out of a site-controlled document and may be absolute, so it
  // can name a private address or a non-HTTP scheme. Validate before fetching,
  // the same way openapi-exists and mcp-endpoint gate the URLs they harvest.
  if (!(await isSafeUrl(url))) return { kind: 'refused', url };

  try {
    // A preflight is what a browser sends first; some servers answer CORS
    // headers only on the actual request, so GET is the documented fallback.
    for (const method of ['OPTIONS', 'GET'] as const) {
      const result = await ctx.fetch({ url, method });
      const value = result.headers['access-control-allow-origin'];
      if (typeof value === 'string' && value.trim()) {
        return { kind: 'acao', url, value: value.trim() };
      }
    }
    return { kind: 'none', url };
  } catch {
    return { kind: 'error', url };
  }
}

const EXPECTED =
  'Endpoints declared by the published OpenAPI document answer with an Access-Control-Allow-Origin that admits a third-party origin';

const SAMPLE = `# On the endpoints your OpenAPI document declares — not a guessed /api/
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization

# A single named origin admits that origin and nothing else, so a
# browser-sandboxed agent on any other origin is still blocked.`;

export class CorsApiRoutesAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'agent-interfaces/cors-api-routes',
    category: 'agent-interfaces',
    title: 'CORS on declared API routes',
    failureTitle: 'CORS on declared API routes',
    description:
      'CORS matters for one class of AI consumer: agent code running inside a browser origin, such as an OpenAI Apps SDK widget in an isolated iframe under a strict CSP. Server-side crawlers and MCP clients are not browsers and are unaffected. This audit reads the endpoints out of your published OpenAPI document and probes those, and applies only to sites that publish one.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/agent-interfaces/cors-api-routes.md',
    // The affected consumer class is small; nothing here should outrank an
    // item that changes what a crawler or an MCP client can do.
    defaultPriority: 'low',
    guidance: {
      impact:
        'A browser-sandboxed agent — an OpenAI Apps SDK widget, or in-page agent JavaScript — must pass a CORS preflight before it can call your API, and is blocked without an Access-Control-Allow-Origin that admits its origin. Nothing else in the AI consumer set is affected: GPTBot, ClaudeBot, PerplexityBot, every server-side agent backend and every MCP client are non-browser HTTP clients that do not implement the same-origin policy at all.',
      fix: 'Answer OPTIONS and GET on the endpoints your OpenAPI document declares with Access-Control-Allow-Origin. Use * for a public read API; if you must name origins, note that a single named origin admits only that origin, so a browser-sandboxed agent elsewhere is still blocked. Never widen CORS on an authenticated endpoint without also getting the credentials rules right.',
      code: SAMPLE,
      effort: 'easy',
      docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS',
      tags: ['cors', 'api', 'headers', 'browser-agents'],
    },
  };

  private recommendation() {
    return {
      priority: 'low' as const,
      description: CorsApiRoutesAudit.meta.description,
      code: SAMPLE,
    };
  }

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const spec = readSpec(ctx);
    if (!spec) {
      // A brochure site has no API surface, and the old audit charged it half a
      // point for that. Note this deliberately does not consult /openapi.yaml:
      // resolving servers[] out of YAML needs a parser we do not have.
      return this.notApplicable(
        'This site publishes no OpenAPI document at /openapi.json, so there is no declared API surface for a browser-sandboxed agent to call cross-origin.',
        EXPECTED,
        'No OpenAPI document at /openapi.json',
      );
    }

    const targets = resolveTargets(ctx, spec);
    if (targets.length === 0) {
      return this.notApplicable(
        'The published OpenAPI document declares no endpoint that can be resolved to a URL, so there is nothing to probe.',
        EXPECTED,
        'No resolvable endpoint in the OpenAPI document',
      );
    }

    const probes: Probe[] = [];
    for (const url of targets) probes.push(await probe(ctx, url));

    const admitting = probes.find((p) => p.kind === 'acao' && p.value === '*');
    if (admitting && admitting.kind === 'acao') {
      return this.pass(
        `Declared API endpoints answer with Access-Control-Allow-Origin: *, so a browser-sandboxed agent on any origin can call them.`,
        EXPECTED,
        `${admitting.url} -> access-control-allow-origin: *`,
      );
    }

    const named = probes.find((p) => p.kind === 'acao');
    if (named && named.kind === 'acao') {
      const own = new URL(ctx.baseUrl).origin;
      let value: string;
      try {
        value = new URL(named.value).origin;
      } catch {
        value = named.value;
      }
      const sameOrigin = value === own;
      return this.warn(
        sameOrigin
          ? `Declared API endpoints allow only the site's own origin (${named.value}), which admits no third party — a browser-sandboxed agent is still blocked.`
          : `Declared API endpoints allow one named origin (${named.value}). A browser-sandboxed agent runs from a different origin, so it is still blocked.`,
        EXPECTED,
        `${named.url} -> access-control-allow-origin: ${named.value}`,
        this.recommendation(),
      );
    }

    if (probes.every((p) => p.kind === 'refused')) {
      return this.warn(
        `The OpenAPI document declares its servers at addresses that are not safe to probe (non-HTTP scheme or private address), so CORS could not be verified.`,
        EXPECTED,
        `${probes[0]!.url} -> refused`,
        this.recommendation(),
      );
    }

    if (probes.every((p) => p.kind === 'error' || p.kind === 'refused')) {
      return this.warn(
        'The endpoints declared by the OpenAPI document could not be reached, so CORS could not be verified.',
        EXPECTED,
        `${probes[0]!.url} -> unreachable`,
        this.recommendation(),
      );
    }

    return this.warn(
      'No endpoint declared by the OpenAPI document answers with an Access-Control-Allow-Origin header, so agent code running inside a browser origin cannot call this API. Server-side crawlers and MCP clients are unaffected.',
      EXPECTED,
      `${probes.length} declared endpoint(s) probed, no Access-Control-Allow-Origin on any`,
      this.recommendation(),
    );
  }
}
