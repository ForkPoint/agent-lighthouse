import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from "../../scorer";
import type { CheckContext } from "../../check-context";
import { NO_OPENAPI_SPEC, readOpenApiSpec } from "../../gatherers/openapi";

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

import { probeOpenApiServer } from "../../gatherers/openapi";

export class OpenApiServersAudit extends Audit {
  static override meta: AuditMeta = {
    id: "agent-interfaces/openapi-servers",
    category: "agent-interfaces",
    title: "OpenAPI servers array valid",
    failureTitle: "OpenAPI servers array valid",
    description:
      "Without a servers array, AI agents do not know the base URL for your API. They cannot construct valid request URLs, rendering the entire spec unusable. Add at least your production server URL.",
    scoreDisplayMode: "ternary",
    weight: weightForGrade("B", "scored"),
    evidenceGrade: "B",
    tier: "scored",
    dossier: "docs/evidence/audits/agent-interfaces/openapi-servers.md",
    requires: ["origin-reachable"],
    defaultPriority: "high",
    guidance: {
      impact:
        "Without a servers array, AI agents cannot determine the base URL for your API. Even if your endpoints are perfectly documented, agents cannot construct valid request URLs, rendering the entire OpenAPI spec unusable.",
      fix: "Add a servers array to your OpenAPI spec with at least your production server URL. Include a description for clarity.",
      code: `"servers": [
  {
    "url": "https://yoursite.com/api",
    "description": "Production server"
  }
]`,
      effort: "trivial",
      docsUrl: "https://swagger.io/specification/#server-object",
      tags: ["openapi", "servers", "api"],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const spec = readOpenApiSpec(ctx);
    // Absent artifact, absent verdict. This audit judges a document's
    // `servers` array; a site that publishes no document has not written a
    // bad one. See `gatherers/openapi.ts` for why the precondition lives
    // there and not in the runner or in `requires`.
    if (!spec) {
      return this.notApplicable(
        NO_OPENAPI_SPEC.message,
        "servers array has at least one entry with a reachable url",
        NO_OPENAPI_SPEC.found,
      );
    }

    const servers = spec["servers"];
    if (!Array.isArray(servers) || servers.length === 0) {
      return this.fail(
        "No servers array in OpenAPI spec.",
        "servers array has at least one entry with a reachable url",
        "No servers array",
        {
          priority: "high",
          description: OpenApiServersAudit.meta.description,
          code: `"servers": [\n  {\n    "url": "https://yoursite.com/api",\n    "description": "Production server"\n  }\n]`,
        },
      );
    }

    const firstWithUrl = servers.find(
      (s) => isObject(s) && typeof s["url"] === "string" && s["url"],
    );
    if (!firstWithUrl) {
      return this.fail(
        "servers array has no entries with a url field.",
        "servers array has at least one entry with a reachable url",
        "No url in servers entries",
        {
          priority: "high",
          description: OpenApiServersAudit.meta.description,
          code: `"servers": [\n  {\n    "url": "https://yoursite.com/api",\n    "description": "Production server"\n  }\n]`,
        },
      );
    }

    const serverUrl = (firstWithUrl as Record<string, unknown>)[
      "url"
    ] as string;
    const result = await probeOpenApiServer(ctx, serverUrl, { method: "GET" });
    if (result && result.status >= 200 && result.status < 400) {
      return this.pass(
        `Server URL ${serverUrl} is reachable (HTTP ${result.status}).`,
        "servers array has at least one entry with a reachable url",
        `${serverUrl} -> HTTP ${result.status}`,
      );
    }
    if (result) {
      return this.warn(
        `Server URL ${serverUrl} returned HTTP ${result.status}.`,
        "servers array has at least one entry with a reachable url",
        `${serverUrl} -> HTTP ${result.status}`,
        {
          priority: "high",
          description: OpenApiServersAudit.meta.description,
          code: `"servers": [\n  {\n    "url": "https://yoursite.com/api",\n    "description": "Production server"\n  }\n]`,
        },
      );
    }
    return this.warn(
      `Server URL ${serverUrl} could not be reached.`,
      "servers array has at least one entry with a reachable url",
      `${serverUrl} -> unreachable`,
      {
        priority: "high",
        description: OpenApiServersAudit.meta.description,
        code: `"servers": [\n  {\n    "url": "https://yoursite.com/api",\n    "description": "Production server"\n  }\n]`,
      },
    );
  }
}
