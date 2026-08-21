// TODO(redeem): this audit survives only if rewritten (pending triage approval). Target tier: scored.
// Evidence dossier: docs/evidence/audits/agent-interfaces/cors-api-routes.md
// Required rework:
//   Keep scored but notApplicable unless site exposes a public API surface agents would call
//   cross-origin.

import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';

export class CorsApiRoutesAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'agent-interfaces/cors-api-routes',
    category: 'agent-interfaces',
    title: 'CORS on API routes',
    failureTitle: 'CORS on API routes',
    description:
      'Without CORS headers on your API routes, AI agents running in browser contexts (ChatGPT plugins, MCP clients, browser-based tools) cannot make cross-origin API requests. This blocks all agentic workflows that need to call your API on behalf of users.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/agent-interfaces/cors-api-routes.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI agents running in browser contexts (ChatGPT plugins, MCP clients, browser extensions) must pass CORS preflight checks before making API calls. Without CORS headers, every cross-origin API request is silently blocked, preventing all agentic workflows that need to query your product catalog, check inventory, or place orders on behalf of users.',
      fix: 'Configure your API routes to respond to OPTIONS preflight requests with Access-Control-Allow-Origin, Access-Control-Allow-Methods, and Access-Control-Allow-Headers. Apply this to all /api/ routes that AI agents may call.',
      code: 'Access-Control-Allow-Origin: *\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\nAccess-Control-Allow-Headers: Content-Type, Authorization',
      effort: 'easy',
      docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS',
      tags: ['cors', 'api', 'headers'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const page = ctx.pages?.[0];

    // Check if an OpenAPI spec was found in rootFiles
    const openapiPaths = ['/openapi.json', '/openapi.yaml', '/swagger.json'];
    const hasOpenApi = openapiPaths.some(
      (p) => ctx.rootFiles[p] && ctx.rootFiles[p].status === 200,
    );

    if (!hasOpenApi) {
      return this.warn(
        'No OpenAPI spec found — cannot verify CORS on API routes.',
        'OPTIONS request to /api/ returns Access-Control-Allow-Origin header',
        'No OpenAPI specification detected',
        {
          priority: 'low',
          description:
            'If you have API routes, AI agents cannot call them from browser contexts without CORS headers. Publishing an OpenAPI spec with CORS-enabled endpoints enables agentic workflows where AI tools can query your API on behalf of users.',
          code: 'Access-Control-Allow-Origin: *\nAccess-Control-Allow-Methods: GET, POST, OPTIONS',
        },
        page?.url,
      );
    }

    try {
      // Try both with and without trailing slash since some frameworks redirect
      let result = await ctx.fetch({
        url: `${ctx.baseUrl}/api/`,
        method: 'OPTIONS',
      });
      if (result.status >= 300 && result.status < 400) {
        result = await ctx.fetch({
          url: `${ctx.baseUrl}/api`,
          method: 'OPTIONS',
        });
      }
      const acaoValue = result.headers['access-control-allow-origin'];
      const hasCors = acaoValue === '*' || (typeof acaoValue === 'string' && acaoValue.length > 0);

      if (hasCors) {
        return this.pass(
          'API routes have CORS headers enabled.',
          'OPTIONS request to /api/ returns Access-Control-Allow-Origin header',
          `access-control-allow-origin: ${result.headers['access-control-allow-origin']}`,
          page?.url,
        );
      }

      return this.fail(
        'API routes are missing CORS headers. AI agents cannot make cross-origin API requests.',
        'OPTIONS request to /api/ returns Access-Control-Allow-Origin header',
        'No Access-Control-Allow-Origin header on /api/',
        {
          priority: 'high',
          description:
            'Without CORS headers on your API routes, AI agents running in browser contexts (ChatGPT plugins, MCP clients, browser-based tools) cannot make cross-origin API requests. This blocks all agentic workflows that need to call your API on behalf of users.',
          code: 'Access-Control-Allow-Origin: *\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\nAccess-Control-Allow-Headers: Content-Type, Authorization',
        },
        page?.url,
      );
    } catch {
      return this.warn(
        'Failed to fetch OPTIONS /api/ — cannot verify CORS.',
        'OPTIONS request to /api/ returns Access-Control-Allow-Origin header',
        'Fetch error on OPTIONS /api/',
        {
          priority: 'medium',
          description:
            'AI agents making cross-origin API calls first send an OPTIONS preflight request. If your /api/ endpoint does not respond to OPTIONS with CORS headers, all subsequent agent requests are blocked by the browser, preventing any agentic API interaction.',
          code: 'Access-Control-Allow-Origin: *\nAccess-Control-Allow-Methods: GET, POST, OPTIONS',
        },
        page?.url,
      );
    }
  }
}
