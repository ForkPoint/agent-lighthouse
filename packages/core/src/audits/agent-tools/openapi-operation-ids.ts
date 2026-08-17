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

export class OpenApiOperationIdsAudit extends Audit {
  static override meta: AuditMeta = {
    id: '5.3',
    category: 'agent-tools',
    title: 'OpenAPI has operationIds',
    failureTitle: 'OpenAPI has operationIds',
    description:
      'AI agents use operationIds as stable function names when calling your API. Without unique operationIds, agents must guess endpoint names from paths, leading to ambiguity and errors. Use descriptive camelCase names.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI agents use operationIds as stable function names when calling your API. Without unique operationIds, agents must infer endpoint names from URL paths, leading to ambiguous calls, naming collisions, and broken integrations.',
      fix: 'Add a unique, descriptive operationId (camelCase) to every operation in your OpenAPI spec. Use verb-noun format like "searchContent", "submitContactForm", or "getProductDetails".',
      code: `"paths": {
  "/contact": {
    "post": {
      "operationId": "submitContactForm",
      "summary": "Submit a contact inquiry"
    }
  },
  "/search": {
    "get": {
      "operationId": "searchContent",
      "summary": "Search site content"
    }
  }
}`,
      effort: 'easy',
      docsUrl: 'https://swagger.io/specification/#operation-object',
      tags: ['openapi', 'operation-ids', 'api'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const spec = getOpenApiSpec(ctx);
    if (!spec) {
      return this.fail(
        'No parseable OpenAPI JSON spec found.',
        'Every operation has a unique operationId',
        'No spec',
        {
          priority: 'medium',
          description: OpenApiOperationIdsAudit.meta.description,
          code: `"paths": {\n  "/contact": {\n    "post": {\n      "operationId": "submitContactForm",\n      "summary": "Submit a contact inquiry"\n    }\n  },\n  "/search": {\n    "get": {\n      "operationId": "searchContent",\n      "summary": "Search site content"\n    }\n  }\n}`,
        },
      );
    }

    const ops = getOperations(spec);
    if (ops.length === 0) {
      return this.fail(
        'No operations to check.',
        'Every operation has a unique operationId',
        '0 operations',
        {
          priority: 'medium',
          description: OpenApiOperationIdsAudit.meta.description,
          code: `"paths": {\n  "/contact": {\n    "post": {\n      "operationId": "submitContactForm",\n      "summary": "Submit a contact inquiry"\n    }\n  },\n  "/search": {\n    "get": {\n      "operationId": "searchContent",\n      "summary": "Search site content"\n    }\n  }\n}`,
        },
      );
    }

    const ids = new Set<string>();
    let missing = 0;
    let duplicates = 0;

    for (const { op } of ops) {
      const id = op['operationId'];
      if (typeof id !== 'string' || !id) {
        missing++;
      } else if (ids.has(id)) {
        duplicates++;
      } else {
        ids.add(id);
      }
    }

    if (missing === 0 && duplicates === 0) {
      return this.pass(
        `All ${ops.length} operation(s) have unique operationIds.`,
        'Every operation has a unique operationId',
        `${ops.length} unique operationId(s)`,
      );
    }

    const issues: string[] = [];
    if (missing > 0) issues.push(`${missing} missing`);
    if (duplicates > 0) issues.push(`${duplicates} duplicate(s)`);

    return this.warn(
      `operationId issues: ${issues.join(', ')} out of ${ops.length} operation(s).`,
      'Every operation has a unique operationId',
      issues.join(', '),
      {
        priority: 'medium',
        description: OpenApiOperationIdsAudit.meta.description,
        code: `"paths": {\n  "/contact": {\n    "post": {\n      "operationId": "submitContactForm",\n      "summary": "Submit a contact inquiry"\n    }\n  },\n  "/search": {\n    "get": {\n      "operationId": "searchContent",\n      "summary": "Search site content"\n    }\n  }\n}`,
      },
    );
  }
}
