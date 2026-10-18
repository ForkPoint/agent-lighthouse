import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import type { CheckContext } from "#core/check-context";
import { weightForGrade } from "#core/scorer";

import type { FetchResult } from "#core/fetcher";
import { sharedProbeUrl } from "#core/gatherers/discovery";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
  HttpMethod,
} from "#core/types";
import { isRootArtifact } from "#core/gatherers/root-files";

/**
 * A fixed third-party origin for the probe. A browser always sends Origin on a
 * cross-origin request, and many servers and CDNs emit
 * Access-Control-Allow-Origin only when it is present, so a probe without one
 * reads a correctly configured file as "no CORS".
 */
const PROBE_ORIGIN = "https://example.invalid";

function carriesAcao(result: FetchResult | undefined): boolean {
  const value = result?.headers["access-control-allow-origin"];
  return typeof value === "string" && value.trim().length > 0;
}

const EXPECTED =
  "Cross-origin requests (OPTIONS preflight or GET, with Origin) to /llms.txt and /.well-known/ai-catalog.json return Access-Control-Allow-Origin";

export class CorsAiFilesAudit extends Audit {
  static override meta: AuditMeta = {
    id: "machine-discovery/cors-ai-files",
    category: "machine-discovery",
    title: "CORS on AI files",
    failureTitle: "CORS on AI files",
    description:
      "Without CORS headers, agent code running inside a browser origin cannot fetch your llms.txt or AI catalog cross-origin. Server-side crawlers, agent backends and MCP clients are not browsers and are unaffected.",
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: weightForGrade(EvidenceGrade.C, AuditTier.Informative),
    evidenceGrade: EvidenceGrade.C,
    tier: AuditTier.Informative,
    dossier: "docs/evidence/audits/machine-discovery/cors-ai-files.md",
    requires: [
      EvidenceKey.OriginReachable,
      EvidenceKey.UnblockedFetches,
      EvidenceKey.RenderedBody,
      EvidenceKey.SampleAdequate,
    ],
    defaultPriority: CheckPriority.Medium,
    guidance: {
      impact:
        "Agent code running inside a browser origin, such as a sandboxed app iframe, is governed by the same-origin policy. Without CORS headers on your llms.txt and AI catalog, such code receives a network error instead of your content. Server-side crawlers, agent backends and MCP clients are not browsers and are unaffected.",
      fix: "Add Access-Control-Allow-Origin and Access-Control-Allow-Methods headers to your /llms.txt and /.well-known/ai-catalog.json responses. Use a wildcard origin (*) unless you need to restrict access to specific domains.",
      code: "Access-Control-Allow-Origin: *\nAccess-Control-Allow-Methods: GET, OPTIONS",
      effort: FixEffort.Easy,
      docsUrl: "https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS",
      tags: ["cors", "ai-files", "headers"],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const page = ctx.pages?.[0];
    const aiPaths = ["/llms.txt", "/.well-known/ai-catalog.json"];
    const hasRootFiles = ctx.rootFiles && Object.keys(ctx.rootFiles).length > 0;
    const existingAiPaths = hasRootFiles
      ? aiPaths.filter((p) => isRootArtifact(ctx.rootFiles[p]))
      : aiPaths;

    // No AI file, no CORS headers to read. A site that publishes neither file
    // has nothing for a cross-origin agent to fetch, so this is not a defect.
    if (hasRootFiles && existingAiPaths.length === 0) {
      return this.notApplicable(
        "No AI files (/llms.txt, /.well-known/ai-catalog.json) found to check CORS headers.",
        EXPECTED,
        "No applicable AI files found",
        page?.url,
      );
    }

    const corsResults: Array<{ path: string; hasCors: boolean }> = [];

    for (const path of existingAiPaths) {
      const url = `${ctx.baseUrl}${path}`;
      // The preflight a browser would send first, then the plain GET a simple
      // cross-origin fetch actually makes; either answer carrying ACAO counts.
      const preflight = await sharedProbeUrl(ctx, url, {
        method: HttpMethod.Options,
        headers: {
          Origin: PROBE_ORIGIN,
          "Access-Control-Request-Method": "GET",
        },
      });
      let hasCors = carriesAcao(preflight);
      if (!hasCors) {
        const get = await sharedProbeUrl(ctx, url, {
          method: HttpMethod.Get,
          headers: { Origin: PROBE_ORIGIN },
        });
        hasCors = carriesAcao(get);
      }
      corsResults.push({ path, hasCors });
    }

    const withCors = corsResults.filter((r) => r.hasCors);
    const withoutCors = corsResults.filter((r) => !r.hasCors);

    if (withoutCors.length === 0) {
      return this.pass(
        "All AI files have CORS headers (Access-Control-Allow-Origin).",
        EXPECTED,
        `CORS enabled: ${withCors.map((r) => r.path).join(", ")}`,
        page?.url,
      );
    }

    if (withCors.length > 0) {
      return this.warn(
        `Some AI files are missing CORS headers: ${withoutCors.map((r) => r.path).join(", ")}`,
        EXPECTED,
        `CORS present: ${withCors.map((r) => r.path).join(", ")}; Missing: ${withoutCors.map((r) => r.path).join(", ")}`,
        {
          priority: CheckPriority.Medium,
          description: CorsAiFilesAudit.meta.description,
          code: "Access-Control-Allow-Origin: *\nAccess-Control-Allow-Methods: GET, OPTIONS",
        },
        page?.url,
      );
    }

    return this.fail(
      "No AI files have CORS headers. Cross-origin AI agents cannot access these files.",
      EXPECTED,
      `No CORS headers on: ${withoutCors.map((r) => r.path).join(", ")}`,
      {
        priority: CheckPriority.Medium,
        description:
          "Without CORS headers, agent code running inside a browser origin cannot fetch your llms.txt or AI catalog cross-origin. Server-side crawlers, agent backends and MCP clients are not browsers and are unaffected.",
        code: "Access-Control-Allow-Origin: *\nAccess-Control-Allow-Methods: GET, OPTIONS",
      },
      page?.url,
    );
  }
}
