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

export class OpenApiExistsAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'agent-interfaces/openapi-exists',
    category: 'agent-interfaces',
    title: 'OpenAPI spec exists',
    failureTitle: 'OpenAPI spec exists',
    description:
      'Without an OpenAPI spec, AI agents can only read your site but cannot take actions like submitting forms, searching, or booking demos. An OpenAPI spec turns your site from a passive document into an interactive tool that agents can use on behalf of users.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/agent-interfaces/openapi-exists.md',
    defaultPriority: 'high',
    guidance: {
      impact:
        'Without an OpenAPI spec, AI agents can only read your pages but cannot take actions like submitting forms, searching content, or booking demos. Your site is invisible as an interactive tool, and agents will direct users to competitors who expose APIs.',
      fix: "Create an /openapi.json file (OpenAPI 3.0+) describing your site's API endpoints. Start with your most important interactions: contact forms, search, and product lookups.",
      code: `// /openapi.json
{
  "openapi": "3.0.3",
  "info": {
    "title": "Your Site API",
    "version": "1.0.0",
    "x-ai-instructions": "Use this API to interact with Your Site."
  },
  "servers": [{ "url": "https://yoursite.com/api" }],
  "paths": {
    "/contact": {
      "post": {
        "operationId": "submitContact",
        "summary": "Submit a contact inquiry",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "name": { "type": "string" },
                  "email": { "type": "string" },
                  "message": { "type": "string" }
                }
              }
            }
          }
        },
        "responses": { "200": { "description": "Success" } }
      }
    }
  }
}`,
      effort: 'moderate',
      docsUrl: 'https://swagger.io/specification/',
      tags: ['openapi', 'api', 'discovery'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const jsonResult = ctx.rootFiles['/openapi.json'];
    const yamlResult = ctx.rootFiles['/openapi.yaml'];

    // Try JSON first
    if (jsonResult && jsonResult.status === 200 && jsonResult.body) {
      const parsed = tryParseJson(jsonResult.body);
      if (isObject(parsed)) {
        return this.pass(
          'Valid OpenAPI JSON spec found at /openapi.json.',
          '/openapi.json or /openapi.yaml returns 200 with valid content',
          'Valid JSON at /openapi.json',
        );
      }
    }

    // Try YAML
    if (yamlResult && yamlResult.status === 200 && yamlResult.body) {
      if (yamlResult.body.includes('openapi:')) {
        return this.pass(
          'OpenAPI YAML spec found at /openapi.yaml.',
          '/openapi.json or /openapi.yaml returns 200 with valid content',
          'YAML with openapi: directive at /openapi.yaml',
        );
      }
    }

    return this.fail(
      'No valid OpenAPI spec found at /openapi.json or /openapi.yaml.',
      '/openapi.json or /openapi.yaml returns 200 with valid content',
      'No valid OpenAPI spec detected',
      {
        priority: 'high',
        description:
          'Without an OpenAPI spec, AI agents can only read your site but cannot take actions like submitting forms, searching, or booking demos. An OpenAPI spec turns your site from a passive document into an interactive tool that agents can use on behalf of users.',
        code: `// /openapi.json\n{\n  "openapi": "3.0.3",\n  "info": {\n    "title": "Your Site API",\n    "version": "1.0.0",\n    "x-ai-instructions": "Use this API to interact with Your Site."\n  },\n  "servers": [{ "url": "https://yoursite.com/api" }],\n  "paths": {\n    "/contact": {\n      "post": {\n        "operationId": "submitContact",\n        "summary": "Submit a contact inquiry",\n        "requestBody": {\n          "content": {\n            "application/json": {\n              "schema": {\n                "type": "object",\n                "properties": {\n                  "name": { "type": "string" },\n                  "email": { "type": "string" },\n                  "message": { "type": "string" }\n                }\n              }\n            }\n          }\n        },\n        "responses": { "200": { "description": "Success" } }\n      }\n    }\n  }\n}`,
      },
    );
  }
}
