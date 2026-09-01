import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from "../../scorer";
import type { CheckContext } from "../../check-context";
import {
  defectCount,
  defectNote,
  NO_OPENAPI_SPEC,
  readOpenApiPaths,
  readOpenApiSpec,
} from "../../gatherers/openapi";

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

/** Shared `expected` line, used by every branch below. */
const EXPECTED =
  "Operations have requestBody and responses with schema definitions";

export class OpenApiSchemasAudit extends Audit {
  static override meta: AuditMeta = {
    id: "agent-interfaces/openapi-schemas",
    category: "agent-interfaces",
    title: "OpenAPI request/response schemas",
    failureTitle: "OpenAPI request/response schemas",
    description:
      "Without request/response schemas, AI agents must guess the data format for your endpoints. This leads to malformed requests and failed API calls. Define JSON schemas for all request bodies and responses.",
    scoreDisplayMode: "ternary",
    weight: weightForGrade("B", "scored"),
    evidenceGrade: "B",
    tier: "scored",
    dossier: "docs/evidence/audits/agent-interfaces/openapi-schemas.md",
    requires: ["origin-reachable"],
    defaultPriority: "medium",
    guidance: {
      impact:
        "Without request/response schemas, AI agents must guess what data to send and what to expect back. This leads to malformed requests, failed API calls, and agents that cannot reliably use your endpoints.",
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
      effort: "moderate",
      docsUrl: "https://swagger.io/specification/#schema-object",
      tags: ["openapi", "schemas", "api", "validation"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const recommendation = {
      priority: "medium" as const,
      description: OpenApiSchemasAudit.meta.description,
      code: `"post": {\n  "operationId": "submitContact",\n  "requestBody": {\n    "required": true,\n    "content": {\n      "application/json": {\n        "schema": {\n          "type": "object",\n          "required": ["email", "message"],\n          "properties": {\n            "name": { "type": "string" },\n            "email": { "type": "string", "format": "email" },\n            "message": { "type": "string" }\n          }\n        }\n      }\n    }\n  },\n  "responses": {\n    "200": {\n      "description": "Success",\n      "content": {\n        "application/json": {\n          "schema": {\n            "type": "object",\n            "properties": {\n              "success": { "type": "boolean" },\n              "id": { "type": "string" }\n            }\n          }\n        }\n      }\n    }\n  }\n}`,
    };

    const spec = readOpenApiSpec(ctx);
    // Absent artifact, absent verdict. This audit judges the schemas attached
    // to a document's operations; no document means no schema coverage was
    // ever observed.
    if (!spec) {
      return this.notApplicable(
        NO_OPENAPI_SPEC.message,
        EXPECTED,
        NO_OPENAPI_SPEC.found,
      );
    }

    const paths = readOpenApiPaths(spec);

    // Present and broken is not absent. Nothing under `paths` is readable, so
    // the message below is literally true: no operation's schemas can be read.
    // The author wrote the thing that blocks the agent.
    if (paths.kind === "malformed") {
      return this.fail(
        `The OpenAPI document's paths object is malformed, so no operation's schemas can be read: ${paths.found}.`,
        EXPECTED,
        paths.found,
        recommendation,
      );
    }

    // Declaring no operations is the absence one level down. Coverage of zero
    // operations is a 0/0 measurement, not a finding; `openapi-endpoints` is
    // the audit that reports an empty document, and it reports it once.
    if (paths.kind === "empty") {
      return this.notApplicable(
        "The OpenAPI document declares no operations, so it carries no request or response schemas to check.",
        EXPECTED,
        "0 operations",
      );
    }

    // Coverage is measured over the operations that are readable, and any
    // defective sibling is named rather than counted. A denominator that
    // included entries no agent can walk would grade the site on operations it
    // does not have.
    const ops = paths.operations;
    const note = defectNote(paths.defects);
    const suffix = defectCount(paths.defects);

    let withRequestSchema = 0;
    let withResponseSchema = 0;
    let writeMethods = 0; // POST/PUT/PATCH that should have requestBody

    for (const { method, op } of ops) {
      if (["post", "put", "patch"].includes(method)) {
        writeMethods++;
        const rb = op["requestBody"];
        if (isObject(rb)) {
          const content = rb["content"];
          if (isObject(content)) {
            for (const mediaType of Object.values(content)) {
              if (isObject(mediaType) && mediaType["schema"]) {
                withRequestSchema++;
                break;
              }
            }
          }
        }
      }

      const responses = op["responses"];
      if (isObject(responses)) {
        for (const resp of Object.values(responses)) {
          if (isObject(resp)) {
            const content = (resp as Record<string, unknown>)["content"];
            if (isObject(content)) {
              for (const mediaType of Object.values(content)) {
                if (isObject(mediaType) && mediaType["schema"]) {
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
        `All operations have response schemas${writeMethods > 0 ? ` and all ${writeMethods} write operation(s) have request schemas` : ""}.${note}`,
        EXPECTED,
        `${withResponseSchema}/${totalCheckable} response schemas, ${withRequestSchema}/${writeMethods} request schemas${suffix}`,
      );
    }

    if (hasGoodCoverage) {
      return this.warn(
        `Partial schema coverage: ${withResponseSchema}/${totalCheckable} response schemas, ${withRequestSchema}/${writeMethods} request schemas.${note}`,
        EXPECTED,
        `${withResponseSchema}/${totalCheckable} response, ${withRequestSchema}/${writeMethods} request${suffix}`,
        recommendation,
      );
    }

    return this.fail(
      `Low schema coverage: ${withResponseSchema}/${totalCheckable} response schemas, ${withRequestSchema}/${writeMethods} request schemas.${note}`,
      EXPECTED,
      `${withResponseSchema}/${totalCheckable} response, ${withRequestSchema}/${writeMethods} request${suffix}`,
      recommendation,
    );
  }
}
