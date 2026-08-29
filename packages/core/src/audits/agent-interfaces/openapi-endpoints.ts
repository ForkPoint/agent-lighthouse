import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';
import {
  NO_OPENAPI_SPEC,
  openApiOperations,
  readOpenApiSpec,
} from '../../gatherers/openapi';

export class OpenApiEndpointsAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'agent-interfaces/openapi-endpoints',
    category: 'agent-interfaces',
    title: 'OpenAPI has endpoints',
    failureTitle: 'OpenAPI has endpoints',
    description:
      'An OpenAPI spec without endpoints is like a menu with no items. AI agents need at least one path with an operation to know what actions they can perform on your site. Add your most important endpoints first.',
    scoreDisplayMode: 'binary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier: 'docs/evidence/audits/agent-interfaces/openapi-endpoints.md',
    requires: ['origin-reachable'],
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
    const spec = readOpenApiSpec(ctx);
    // Absent artifact, absent verdict. A menu with no items is a finding; a
    // restaurant that prints no menu is not. The `fail` below still stands
    // for a document that exists and declares nothing.
    if (!spec) {
      return this.notApplicable(
        NO_OPENAPI_SPEC.message,
        'At least one path with one operation in the OpenAPI spec',
        NO_OPENAPI_SPEC.found,
      );
    }

    const ops = openApiOperations(spec);
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
