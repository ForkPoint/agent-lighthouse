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

/**
 * The naming rule folded in from v1 5.23 (webmcp-tool-naming) on 2026-08-22.
 *
 * An operationId is the function name a tool-calling runtime registers, and
 * Anthropic's tool `name` "must match the regex `^[a-zA-Z0-9_-]{1,64}$`", with
 * Gemini asking for "descriptive names without spaces or special characters".
 * An id outside this shape cannot be registered verbatim, so it is a harder
 * breakage than a missing id (which converters synthesize from method + path).
 *
 * 5.23's English-verb allowlist and its 20-character description floor are
 * deliberately NOT ported: no spec or vendor doc constrains naming style or
 * description length, and the allowlist rejected snake_case — the casing of
 * MCP's own example tool.
 */
const LEGAL_OPERATION_ID = /^[a-zA-Z0-9_-]{1,64}$/;

/** Shared `expected` line: uniqueness and registrability are one requirement. */
const EXPECTED = 'Every operation has a unique operationId that is a legal tool-call function name';

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
    id: 'agent-interfaces/openapi-operation-ids',
    category: 'agent-interfaces',
    title: 'OpenAPI has operationIds',
    failureTitle: 'OpenAPI has operationIds',
    description:
      'AI agents use operationIds as stable function names when calling your API. Without unique operationIds, agents must guess endpoint names from paths, leading to ambiguity and errors. An operationId that is not a legal function name (spaces, punctuation, or more than 64 characters) cannot be registered as a tool at all.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier: 'docs/evidence/audits/agent-interfaces/openapi-operation-ids.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI agents use operationIds as stable function names when calling your API. Without unique operationIds, agents must infer endpoint names from URL paths, leading to ambiguous calls, naming collisions, and broken integrations.',
      fix: 'Add a unique, descriptive operationId to every operation in your OpenAPI spec, and keep it inside ^[a-zA-Z0-9_-]{1,64}$ so a tool-calling runtime can register it verbatim. Verb-noun names read best — "searchContent", "submitContactForm", "get_product_details" — but casing style is not the constraint; spaces, punctuation and length are.',
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
        EXPECTED,
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
        EXPECTED,
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
    const illegal: string[] = [];

    for (const { op } of ops) {
      const id = op['operationId'];
      if (typeof id !== 'string' || !id) {
        missing++;
        continue;
      }
      if (!LEGAL_OPERATION_ID.test(id)) illegal.push(id);
      if (ids.has(id)) {
        duplicates++;
      } else {
        ids.add(id);
      }
    }

    if (missing === 0 && duplicates === 0 && illegal.length === 0) {
      return this.pass(
        `All ${ops.length} operation(s) have unique, registrable operationIds.`,
        EXPECTED,
        `${ops.length} unique operationId(s)`,
      );
    }

    const issues: string[] = [];
    if (illegal.length > 0) issues.push(`${illegal.length} cannot be registered as a tool name`);
    if (missing > 0) issues.push(`${missing} missing`);
    if (duplicates > 0) issues.push(`${duplicates} duplicate(s)`);

    // An illegal id is rejected at tool-registration time, so it breaks the
    // call outright; a missing or duplicated id only degrades naming.
    if (illegal.length > 0) {
      return this.fail(
        `operationId issues: ${issues.join(', ')} out of ${ops.length} operation(s).`,
        EXPECTED,
        `Illegal operationId(s): ${illegal.join(', ')}${missing > 0 ? `; ${missing} missing` : ''}${duplicates > 0 ? `; ${duplicates} duplicate(s)` : ''}`,
        {
          priority: 'medium',
          description:
            'A tool-calling runtime registers each operationId as a function name. Anthropic requires that name to match ^[a-zA-Z0-9_-]{1,64}$, so an operationId carrying spaces, punctuation or more than 64 characters cannot be registered verbatim and the operation is unreachable.',
          code: `"paths": {\n  "/contact": {\n    "post": {\n      "operationId": "submitContactForm"\n    }\n  }\n}`,
        },
      );
    }

    return this.warn(
      `operationId issues: ${issues.join(', ')} out of ${ops.length} operation(s).`,
      EXPECTED,
      issues.join(', '),
      {
        priority: 'medium',
        description: OpenApiOperationIdsAudit.meta.description,
        code: `"paths": {\n  "/contact": {\n    "post": {\n      "operationId": "submitContactForm",\n      "summary": "Submit a contact inquiry"\n    }\n  },\n  "/search": {\n    "get": {\n      "operationId": "searchContent",\n      "summary": "Search site content"\n    }\n  }\n}`,
      },
    );
  }
}
