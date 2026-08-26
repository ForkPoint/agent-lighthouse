import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';

export class CorsAiFilesAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'machine-discovery/cors-ai-files',
    category: 'machine-discovery',
    title: 'CORS on AI files',
    failureTitle: 'CORS on AI files',
    description:
      'Without CORS headers, AI agents running in browser contexts cannot fetch your llms.txt or API spec. Browser-based AI tools, ChatGPT plugins, and MCP clients are all blocked by same-origin policy, making your AI-facing files completely inaccessible to cross-origin agents.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/machine-discovery/cors-ai-files.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Browser-based AI tools, ChatGPT plugins, and MCP clients all run in browser contexts governed by the same-origin policy. Without CORS headers on your llms.txt and AI catalog, these agents receive a network error instead of your content — making your AI-facing files completely invisible to the fastest-growing category of AI consumers.',
      fix: 'Add Access-Control-Allow-Origin and Access-Control-Allow-Methods headers to your /llms.txt and /.well-known/ai-catalog.json responses. Use a wildcard origin (*) unless you need to restrict access to specific domains.',
      code: 'Access-Control-Allow-Origin: *\nAccess-Control-Allow-Methods: GET, OPTIONS',
      effort: 'easy',
      docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS',
      tags: ['cors', 'ai-files', 'headers'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const page = ctx.pages?.[0];
    const aiPaths = ['/llms.txt', '/.well-known/ai-catalog.json'];
    const hasRootFiles = ctx.rootFiles && Object.keys(ctx.rootFiles).length > 0;
    const existingAiPaths = hasRootFiles
      ? aiPaths.filter((p) => ctx.rootFiles[p]?.status === 200)
      : aiPaths;

    if (hasRootFiles && existingAiPaths.length === 0) {
      return this.warn(
        'No AI files (/llms.txt, /.well-known/ai-catalog.json) found to check CORS headers.',
        'OPTIONS requests to /llms.txt and /.well-known/ai-catalog.json return Access-Control-Allow-Origin',
        'No applicable AI files found',
        undefined,
        page?.url,
      );
    }

    const corsResults: Array<{ path: string; hasCors: boolean }> = [];

    for (const path of existingAiPaths) {
      try {
        const result = await ctx.fetch({
          url: `${ctx.baseUrl}${path}`,
          method: 'OPTIONS',
        });
        const acaoValue = result.headers['access-control-allow-origin'];
        const hasCors = acaoValue === '*' || (typeof acaoValue === 'string' && acaoValue.length > 0);
        corsResults.push({ path, hasCors });
      } catch {
        corsResults.push({ path, hasCors: false });
      }
    }

    const withCors = corsResults.filter((r) => r.hasCors);
    const withoutCors = corsResults.filter((r) => !r.hasCors);

    if (withoutCors.length === 0) {
      return this.pass(
        'All AI files have CORS headers (Access-Control-Allow-Origin).',
        'OPTIONS requests to /llms.txt and /.well-known/ai-catalog.json return Access-Control-Allow-Origin',
        `CORS enabled: ${withCors.map((r) => r.path).join(', ')}`,
        page?.url,
      );
    }

    if (withCors.length > 0) {
      return this.warn(
        `Some AI files are missing CORS headers: ${withoutCors.map((r) => r.path).join(', ')}`,
        'OPTIONS requests to /llms.txt and /.well-known/ai-catalog.json return Access-Control-Allow-Origin',
        `CORS present: ${withCors.map((r) => r.path).join(', ')}; Missing: ${withoutCors.map((r) => r.path).join(', ')}`,
        {
          priority: 'medium',
          description:
            'Without CORS headers, AI agents running in browser contexts cannot fetch your llms.txt or AI catalog. Browser-based AI tools and ChatGPT plugins are blocked by same-origin policy, making your AI-facing files inaccessible to the agents that need them most.',
          code: 'Access-Control-Allow-Origin: *\nAccess-Control-Allow-Methods: GET, OPTIONS',
        },
        page?.url,
      );
    }

    return this.fail(
      'No AI files have CORS headers. Cross-origin AI agents cannot access these files.',
      'OPTIONS requests to /llms.txt and /.well-known/ai-catalog.json return Access-Control-Allow-Origin',
      `No CORS headers on: ${withoutCors.map((r) => r.path).join(', ')}`,
      {
        priority: 'medium',
        description:
          'Without CORS headers, AI agents running in browser contexts cannot fetch your llms.txt or API spec. Browser-based AI tools, ChatGPT plugins, and MCP clients are all blocked by same-origin policy, making your AI-facing files completely inaccessible to cross-origin agents.',
        code: 'Access-Control-Allow-Origin: *\nAccess-Control-Allow-Methods: GET, OPTIONS',
      },
      page?.url,
    );
  }
}
