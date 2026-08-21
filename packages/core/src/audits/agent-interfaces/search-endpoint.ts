import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';

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

type OpenApiPaths = Record<string, Record<string, unknown>>;
type OpenApiOperation = Record<string, unknown>;

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'];

function getOpenApiSpec(ctx: {
  rootFiles: Record<string, { status: number; body: string }>;
}): Record<string, unknown> | undefined {
  const jsonResult = ctx.rootFiles['/openapi.json'];
  if (jsonResult && jsonResult.status === 200 && jsonResult.body) {
    const parsed = tryParseJson(jsonResult.body);
    if (isObject(parsed)) return parsed;
  }
  return undefined;
}

function getOperations(
  spec: Record<string, unknown>,
): Array<{ path: string; method: string; op: OpenApiOperation }> {
  const paths = spec['paths'] as OpenApiPaths | undefined;
  if (!isObject(paths)) return [];

  const ops: Array<{ path: string; method: string; op: OpenApiOperation }> = [];
  for (const [path, pathItem] of Object.entries(paths)) {
    if (!isObject(pathItem)) continue;
    for (const method of HTTP_METHODS) {
      const op = pathItem[method];
      if (isObject(op)) {
        ops.push({ path, method, op: op as OpenApiOperation });
      }
    }
  }
  return ops;
}

function findSearchActionUrl(obj: unknown): string | undefined {
  if (!isObject(obj)) return undefined;

  // Direct match
  if (
    (obj['@type'] === 'SearchAction' || obj['@type'] === 'WebSite') &&
    isObject(obj['potentialAction'])
  ) {
    const action = obj['potentialAction'] as Record<string, unknown>;
    if (action['@type'] === 'SearchAction' && isObject(action['target'])) {
      const target = action['target'] as Record<string, unknown>;
      if (typeof target['urlTemplate'] === 'string') return target['urlTemplate'];
    }
    if (action['@type'] === 'SearchAction' && typeof action['target'] === 'string') {
      return action['target'];
    }
  }

  // Check potentialAction directly
  if (obj['@type'] === 'SearchAction') {
    if (isObject(obj['target'])) {
      const target = obj['target'] as Record<string, unknown>;
      if (typeof target['urlTemplate'] === 'string') return target['urlTemplate'];
    }
    if (typeof obj['target'] === 'string') return obj['target'];
  }

  // Recurse into @graph
  if (Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph']) {
      const url = findSearchActionUrl(item);
      if (url) return url;
    }
  }

  return undefined;
}

export class SearchEndpointAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'agent-interfaces/search-endpoint',
    category: 'agent-interfaces',
    title: 'Search endpoint functional',
    failureTitle: 'Search endpoint functional',
    description:
      'A search endpoint lets AI agents find specific content on your site without crawling every page. When a user asks an agent "find pricing info on Example.com," the agent can use your search API directly. Add a Schema.org SearchAction or an OpenAPI search endpoint.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/agent-interfaces/search-endpoint.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Without a search endpoint, AI agents must crawl every page to find specific content. When a user asks "find pricing info on Example.com," the agent has no efficient way to locate it, resulting in slow or failed responses.',
      fix: 'Add a Schema.org SearchAction to your homepage JSON-LD, or expose a GET search endpoint in your OpenAPI spec. Ensure the endpoint returns results for a test query.',
      code: `<!-- Schema.org SearchAction in JSON-LD -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "url": "https://yoursite.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://yoursite.com/search?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
}
</script>`,
      effort: 'moderate',
      docsUrl: 'https://schema.org/SearchAction',
      tags: ['search', 'schema-org', 'openapi', 'api'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    // Check JSON-LD for WebSite SearchAction
    for (const page of ctx.pages) {
      for (const ld of page.jsonLd) {
        const searchUrl = findSearchActionUrl(ld);
        if (searchUrl) {
          // Try to verify the search endpoint by substituting a test query
          const testUrl = searchUrl.replace(/\{[^}]*\}/, 'test');
          try {
            const result = await ctx.fetch({ url: testUrl });
            if (result.status === 200) {
              return this.pass(
                `SearchAction endpoint is functional: ${testUrl} returned HTTP 200.`,
                'WebSite SearchAction URL works or OpenAPI has a search GET endpoint',
                `SearchAction URL: ${searchUrl} -> HTTP 200`,
                page.url,
              );
            }
            return this.warn(
              `SearchAction URL found but returned HTTP ${result.status}.`,
              'WebSite SearchAction URL works or OpenAPI has a search GET endpoint',
              `SearchAction URL: ${searchUrl} -> HTTP ${result.status}`,
              {
                priority: 'medium',
                description: SearchEndpointAudit.meta.description,
                code: `<!-- Schema.org SearchAction in JSON-LD -->\n<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "WebSite",\n  "url": "https://yoursite.com",\n  "potentialAction": {\n    "@type": "SearchAction",\n    "target": {\n      "@type": "EntryPoint",\n      "urlTemplate": "https://yoursite.com/search?q={search_term_string}"\n    },\n    "query-input": "required name=search_term_string"\n  }\n}\n</script>`,
              },
              page.url,
            );
          } catch {
            return this.warn(
              `SearchAction URL found but could not be reached: ${searchUrl}.`,
              'WebSite SearchAction URL works or OpenAPI has a search GET endpoint',
              `SearchAction URL: ${searchUrl} -> unreachable`,
              {
                priority: 'medium',
                description: SearchEndpointAudit.meta.description,
                code: `<!-- Schema.org SearchAction in JSON-LD -->\n<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "WebSite",\n  "url": "https://yoursite.com",\n  "potentialAction": {\n    "@type": "SearchAction",\n    "target": {\n      "@type": "EntryPoint",\n      "urlTemplate": "https://yoursite.com/search?q={search_term_string}"\n    },\n    "query-input": "required name=search_term_string"\n  }\n}\n</script>`,
              },
              page.url,
            );
          }
        }
      }
    }

    // Check OpenAPI for search-like GET endpoints
    const spec = getOpenApiSpec(ctx);
    if (spec) {
      const ops = getOperations(spec);
      for (const { path, method } of ops) {
        if (method === 'get' && path.toLowerCase().includes('search')) {
          return this.pass(
            `OpenAPI has GET search endpoint: ${path}.`,
            'WebSite SearchAction URL works or OpenAPI has a search GET endpoint',
            `GET ${path}`,
          );
        }
      }
    }

    return this.fail(
      'No functional search endpoint found (no SearchAction or OpenAPI search GET).',
      'WebSite SearchAction URL works or OpenAPI has a search GET endpoint',
      'No search endpoint detected',
      {
        priority: 'medium',
        description: SearchEndpointAudit.meta.description,
        code: `<!-- Schema.org SearchAction in JSON-LD -->\n<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "WebSite",\n  "url": "https://yoursite.com",\n  "potentialAction": {\n    "@type": "SearchAction",\n    "target": {\n      "@type": "EntryPoint",\n      "urlTemplate": "https://yoursite.com/search?q={search_term_string}"\n    },\n    "query-input": "required name=search_term_string"\n  }\n}\n</script>`,
      },
    );
  }
}
