import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
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

export class OpenApiEndpointsAudit extends Audit {
  static override meta: AuditMeta = {
    id: '5.2',
    category: 'agent-tools',
    title: 'OpenAPI has endpoints',
    failureTitle: 'OpenAPI has endpoints',
    description:
      'An OpenAPI spec without endpoints is like a menu with no items. AI agents need at least one path with an operation to know what actions they can perform on your site. Add your most important endpoints first.',
    scoreDisplayMode: 'binary',
    weight: 1.0,
    defaultPriority: 'high',
    guidance: {
      impact:
        'An OpenAPI spec without endpoints is unusable -- AI agents see a spec file but have zero actions they can perform. Your site remains a passive document that agents cannot interact with programmatically.',
      fix: 'Add at least one path with an HTTP operation (GET, POST, etc.) to your OpenAPI spec. Start with your most valuable endpoints: search, contact, or product lookup.',
      code: `"paths": {
  "/search": {
    "get": {
      "operationId": "searchContent",
      "summary": "Search site content",
      "parameters": [{
        "name": "q", "in": "query", "schema": { "type": "string" }
      }],
      "responses": { "200": { "description": "Search results" } }
    }
  }
}`,
      effort: 'moderate',
      docsUrl: 'https://swagger.io/specification/#paths-object',
      tags: ['openapi', 'endpoints', 'api'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const spec = getOpenApiSpec(ctx);
    if (!spec) {
      return this.fail(
        'No parseable OpenAPI JSON spec found.',
        'At least one path with one operation in the OpenAPI spec',
        'No spec',
        {
          priority: 'high',
          description: OpenApiEndpointsAudit.meta.description,
          code: `"paths": {\n  "/search": {\n    "get": {\n      "operationId": "searchContent",\n      "summary": "Search site content",\n      "parameters": [{\n        "name": "q", "in": "query", "schema": { "type": "string" }\n      }],\n      "responses": { "200": { "description": "Search results" } }\n    }\n  }\n}`,
        },
      );
    }

    const ops = getOperations(spec);
    if (ops.length > 0) {
      return this.pass(
        `OpenAPI spec defines ${ops.length} operation(s) across its paths.`,
        'At least one path with one operation in the OpenAPI spec',
        `${ops.length} operation(s)`,
      );
    }

    return this.fail(
      'OpenAPI spec has no operations defined in paths.',
      'At least one path with one operation in the OpenAPI spec',
      '0 operations',
      {
        priority: 'high',
        description: OpenApiEndpointsAudit.meta.description,
        code: `"paths": {\n  "/search": {\n    "get": {\n      "operationId": "searchContent",\n      "summary": "Search site content",\n      "parameters": [{\n        "name": "q", "in": "query", "schema": { "type": "string" }\n      }],\n      "responses": { "200": { "description": "Search results" } }\n    }\n  }\n}`,
      },
    );
  }
}
