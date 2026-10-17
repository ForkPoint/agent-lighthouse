import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import { weightForGrade } from "#core/scorer";
import type { CheckContext } from "#core/check-context";
import {
  NO_OPENAPI_SPEC,
  probeOpenApiServer,
  readOpenApiSpec,
} from "#core/gatherers/openapi";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
  HttpMethod,
} from "#core/types";

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

export class OpenApiServersAudit extends Audit {
  static override meta: AuditMeta = {
    id: "agent-interfaces/openapi-servers",
    category: "agent-interfaces",
    title: "OpenAPI servers array valid",
    failureTitle: "OpenAPI servers array valid",
    description:
      "Agents join each operation path to a server URL to build a request. A servers entry with no url, or a servers value that is not an array, leaves them no base URL. An absent servers array is legal: OpenAPI defaults it to `/`.",
    scoreDisplayMode: ScoreDisplayMode.Ternary,
    weight: weightForGrade(EvidenceGrade.B, AuditTier.Scored),
    evidenceGrade: EvidenceGrade.B,
    tier: AuditTier.Scored,
    dossier: "docs/evidence/audits/agent-interfaces/openapi-servers.md",
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    defaultPriority: CheckPriority.High,
    guidance: {
      impact:
        "Agents build each request URL from a server URL and the operation path. A servers entry without a url gives them nothing to join the path to. An absent servers array defaults to `/`, which assumes the API lives on the host that serves the document.",
      fix: "Give every servers entry a url. If the API does not live on the host that serves the document, declare its production server URL explicitly.",
      code: `"servers": [
  {
    "url": "https://yoursite.com/api",
    "description": "Production server"
  }
]`,
      effort: FixEffort.Trivial,
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
    // OpenAPI 3.0 and 3.1 both default an absent or empty `servers` array to
    // one Server Object with url `/`, resolved against the document's own
    // location. The base URL is derivable, so the omission is legal and
    // passes; there is no declared URL to probe.
    if (
      servers === undefined ||
      (Array.isArray(servers) && servers.length === 0)
    ) {
      return this.pass(
        "No servers array; OpenAPI defaults the base URL to `/`, relative to the document.",
        "servers array has at least one entry with a reachable url",
        "No servers array (defaults to /)",
      );
    }
    if (!Array.isArray(servers)) {
      return this.fail(
        "servers in the OpenAPI spec is not an array.",
        "servers array has at least one entry with a reachable url",
        "servers is not an array",
        {
          priority: CheckPriority.High,
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
          priority: CheckPriority.High,
          description: OpenApiServersAudit.meta.description,
          code: `"servers": [\n  {\n    "url": "https://yoursite.com/api",\n    "description": "Production server"\n  }\n]`,
        },
      );
    }

    const serverUrl = (firstWithUrl as Record<string, unknown>)[
      "url"
    ] as string;
    const result = await probeOpenApiServer(ctx, serverUrl, {
      method: HttpMethod.Get,
    });
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
          priority: CheckPriority.High,
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
        priority: CheckPriority.High,
        description: OpenApiServersAudit.meta.description,
        code: `"servers": [\n  {\n    "url": "https://yoursite.com/api",\n    "description": "Production server"\n  }\n]`,
      },
    );
  }
}
