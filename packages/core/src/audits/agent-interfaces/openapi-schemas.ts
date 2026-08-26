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

export class OpenApiSchemasAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'agent-interfaces/openapi-schemas',
    category: 'agent-interfaces',
    title: 'OpenAPI request/response schemas',
    failureTitle: 'OpenAPI request/response schemas',
    description:
      'Without request/response schemas, AI agents must guess the data format for your endpoints. This leads to malformed requests and failed API calls. Define JSON schemas for all request bodies and responses.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier: 'docs/evidence/audits/agent-interfaces/openapi-schemas.md',
    requires: ['origin-reachable'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Without request/response schemas, AI agents must guess what data to send and what to expect back. This leads to malformed requests, failed API calls, and agents that cannot reliably use your endpoints.',
      fix: 'Define JSON Schema for all request bodies (POST/PUT/PATCH) and response bodies in your OpenAPI spec. Include property types, required fields, and format hints (e.g., "format": "email").',
      code: `"post": {
  "operationId": "submitContact",
  "requestBody": {
    "required": true,
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "required": ["email", "message"],
          "properties": {
            "name": { "type": "string" },
            "email": { "type": "string", "format": "email" },
            "message": { "type": "string" }
          }
        }
      }
    }
  },
  "responses": {
    "200": {
      "description": "Success",
      "content": {
        "application/json": {
          "schema": {
            "type": "object",
            "properties": {
              "success": { "type": "boolean" },
              "id": { "type": "string" }
            }
          }
        }
      }
    }
  }
}`,
      effort: 'moderate',
      docsUrl: 'https://swagger.io/specification/#schema-object',
      tags: ['openapi', 'schemas', 'api', 'validation'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const spec = getOpenApiSpec(ctx);
    if (!spec) {
      return this.fail(
        'No parseable OpenAPI JSON spec found.',
        'Operations have requestBody and responses with schema definitions',
        'No spec',
        {
          priority: 'medium',
          description: OpenApiSchemasAudit.meta.description,
          code: `"post": {\n  "operationId": "submitContact",\n  "requestBody": {\n    "required": true,\n    "content": {\n      "application/json": {\n        "schema": {\n          "type": "object",\n          "required": ["email", "message"],\n          "properties": {\n            "name": { "type": "string" },\n            "email": { "type": "string", "format": "email" },\n            "message": { "type": "string" }\n          }\n        }\n      }\n    }\n  },\n  "responses": {\n    "200": {\n      "description": "Success",\n      "content": {\n        "application/json": {\n          "schema": {\n            "type": "object",\n            "properties": {\n              "success": { "type": "boolean" },\n              "id": { "type": "string" }\n            }\n          }\n        }\n      }\n    }\n  }\n}`,
        },
      );
    }

    const ops = getOperations(spec);
    if (ops.length === 0) {
      return this.fail(
        'No operations to check.',
        'Operations have requestBody and responses with schema definitions',
        '0 operations',
        {
          priority: 'medium',
          description: OpenApiSchemasAudit.meta.description,
          code: `"post": {\n  "operationId": "submitContact",\n  "requestBody": {\n    "required": true,\n    "content": {\n      "application/json": {\n        "schema": {\n          "type": "object",\n          "required": ["email", "message"],\n          "properties": {\n            "name": { "type": "string" },\n            "email": { "type": "string", "format": "email" },\n            "message": { "type": "string" }\n          }\n        }\n      }\n    }\n  },\n  "responses": {\n    "200": {\n      "description": "Success",\n      "content": {\n        "application/json": {\n          "schema": {\n            "type": "object",\n            "properties": {\n              "success": { "type": "boolean" },\n              "id": { "type": "string" }\n            }\n          }\n        }\n      }\n    }\n  }\n}`,
        },
      );
    }

    let withRequestSchema = 0;
    let withResponseSchema = 0;
    let writeMethods = 0; // POST/PUT/PATCH that should have requestBody

    for (const { method, op } of ops) {
      if (['post', 'put', 'patch'].includes(method)) {
        writeMethods++;
        const rb = op['requestBody'];
        if (isObject(rb)) {
          const content = rb['content'];
          if (isObject(content)) {
            for (const mediaType of Object.values(content)) {
              if (isObject(mediaType) && mediaType['schema']) {
                withRequestSchema++;
                break;
              }
            }
          }
        }
      }

      const responses = op['responses'];
      if (isObject(responses)) {
        for (const resp of Object.values(responses)) {
          if (isObject(resp)) {
            const content = (resp as Record<string, unknown>)['content'];
            if (isObject(content)) {
              for (const mediaType of Object.values(content)) {
                if (isObject(mediaType) && mediaType['schema']) {
                  withResponseSchema++;
                  break;
                }
              }
              break; // only need one response with schema
            }
          }
        }
      }
    }

    const totalCheckable = ops.length;
    const hasGoodCoverage =
      withResponseSchema >= totalCheckable * 0.5 &&
      (writeMethods === 0 || withRequestSchema >= writeMethods * 0.5);

    if (
      withResponseSchema === totalCheckable &&
      (writeMethods === 0 || withRequestSchema === writeMethods)
    ) {
      return this.pass(
        `All operations have response schemas${writeMethods > 0 ? ` and all ${writeMethods} write operation(s) have request schemas` : ''}.`,
        'Operations have requestBody and responses with schema definitions',
        `${withResponseSchema}/${totalCheckable} response schemas, ${withRequestSchema}/${writeMethods} request schemas`,
      );
    }

    const recommendation = {
      priority: 'medium' as const,
      description: OpenApiSchemasAudit.meta.description,
      code: `"post": {\n  "operationId": "submitContact",\n  "requestBody": {\n    "required": true,\n    "content": {\n      "application/json": {\n        "schema": {\n          "type": "object",\n          "required": ["email", "message"],\n          "properties": {\n            "name": { "type": "string" },\n            "email": { "type": "string", "format": "email" },\n            "message": { "type": "string" }\n          }\n        }\n      }\n    }\n  },\n  "responses": {\n    "200": {\n      "description": "Success",\n      "content": {\n        "application/json": {\n          "schema": {\n            "type": "object",\n            "properties": {\n              "success": { "type": "boolean" },\n              "id": { "type": "string" }\n            }\n          }\n        }\n      }\n    }\n  }\n}`,
    };

    if (hasGoodCoverage) {
      return this.warn(
        `Partial schema coverage: ${withResponseSchema}/${totalCheckable} response schemas, ${withRequestSchema}/${writeMethods} request schemas.`,
        'Operations have requestBody and responses with schema definitions',
        `${withResponseSchema}/${totalCheckable} response, ${withRequestSchema}/${writeMethods} request`,
        recommendation,
      );
    }

    return this.fail(
      `Low schema coverage: ${withResponseSchema}/${totalCheckable} response schemas, ${withRequestSchema}/${writeMethods} request schemas.`,
      'Operations have requestBody and responses with schema definitions',
      `${withResponseSchema}/${totalCheckable} response, ${withRequestSchema}/${writeMethods} request`,
      recommendation,
    );
  }
}
