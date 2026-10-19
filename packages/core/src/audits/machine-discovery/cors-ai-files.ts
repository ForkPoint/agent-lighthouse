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
  NoticeKind,
  ScoreDisplayMode,
  HttpMethod,
} from "#core/types";
import { isRootArtifact } from "#core/gatherers/root-files";
import { CATALOG_PATHS } from "#core/audits/agent-interfaces/_ard";

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
  "Cross-origin requests (OPTIONS preflight or GET, with Origin) to each published AI file (/llms.txt, /.well-known/ard.json, /.well-known/ai-catalog.json) return Access-Control-Allow-Origin";

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
    deprecated: {
      kind: NoticeKind.Unconsumed,
      notice:
        "No AI crawler or assistant documents reading these files from a browser. They fetch them from servers, where CORS does not apply, so CORS headers on them are not needed.",
      link: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS",
    },
    requires: [
      EvidenceKey.OriginReachable,
      EvidenceKey.UnblockedFetches,
      EvidenceKey.RenderedBody,
      EvidenceKey.SampleAdequate,
    ],
    defaultPriority: CheckPriority.Low,
    guidance: {
      impact:
        "Agent code running inside a browser origin, such as a sandboxed app iframe, is governed by the same-origin policy. Without CORS headers on your llms.txt and AI catalog, such code receives a network error instead of your content. Server-side crawlers, agent backends and MCP clients are not browsers and are unaffected.",
      fix: "Optional. Add Access-Control-Allow-Origin only if browser-side code you know of fetches these files cross-origin. Crawlers and server-side agents do not need it.",
      code: "Access-Control-Allow-Origin: *\nAccess-Control-Allow-Methods: GET, OPTIONS",
      effort: FixEffort.Easy,
      docsUrl: "https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS",
      tags: ["cors", "ai-files", "headers"],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const page = ctx.pages?.[0];
    const aiPaths = ["/llms.txt", ...CATALOG_PATHS];
    // Only files the root fetch saw as present are probed. A path the scan
    // never recorded is absent, not a file without CORS: absent artifact,
    // absent verdict.
    const existingAiPaths = aiPaths.filter((p) =>
      isRootArtifact(ctx.rootFiles?.[p]),
    );

    if (existingAiPaths.length === 0) {
      return this.notApplicable(
        `No AI files (${aiPaths.join(", ")}) found to check CORS headers.`,
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

    // Reported, never warned or failed: CORS governs scripts in a browser, and
    // no AI vendor documents fetching these files from one (policy.md,
    // "Informative or obsolete").
    const missing = withoutCors.map((r) => r.path).join(", ");
    const notNeeded =
      "Not needed: crawlers and server-side agents fetch these files from servers, where CORS does not apply.";
    if (withCors.length > 0) {
      return this.pass(
        `Some AI files have no CORS headers: ${missing}. ${notNeeded}`,
        EXPECTED,
        `CORS present: ${withCors.map((r) => r.path).join(", ")}; Missing: ${missing}`,
        page?.url,
      );
    }

    return this.pass(
      `No AI file has CORS headers (${missing}). ${notNeeded}`,
      EXPECTED,
      `No CORS headers on: ${missing}`,
      page?.url,
    );
  }
}
