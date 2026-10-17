import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import type { CheckContext } from "#core/check-context";
import { weightForGrade } from "#core/scorer";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
} from "#core/types";
import { isRootArtifact, rootArtifactMiss } from "#core/gatherers/root-files";

export class LlmsFullTxtAudit extends Audit {
  static override meta: AuditMeta = {
    id: "machine-discovery/llms-full-txt",
    category: "machine-discovery",
    title: "llms-full.txt present",
    failureTitle: "llms-full.txt present",
    description:
      "llms-full.txt provides the complete content of your site in a single file, allowing AI agents to ingest everything in one request instead of crawling page by page.",
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: weightForGrade(EvidenceGrade.C, AuditTier.Informative),
    evidenceGrade: EvidenceGrade.C,
    tier: AuditTier.Informative,
    dossier: "docs/evidence/audits/machine-discovery/llms-full-txt.md",
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    defaultPriority: CheckPriority.High,
    guidance: {
      impact:
        "Without llms-full.txt, AI agents must crawl your site page by page, which is slow and often incomplete. This means AI assistants give shallow or outdated answers about your products and services.",
      fix: "Create a /llms-full.txt file at your site root containing the full text content of all important pages in markdown format. Include headings, descriptions, and key details for each page.",
      code: "# Your Site Name\n\n> Full content version for AI agents.\n\n## Home\nYour homepage content here...\n\n## About\nYour about page content here...\n\n## Documentation\nYour documentation content here...",
      effort: FixEffort.Moderate,
      docsUrl: "https://llmstxt.org/",
      tags: ["llms-txt", "discoverability"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const result = ctx.rootFiles["/llms-full.txt"];

    // An optional file the site never published is not a defect.
    if (!isRootArtifact(result)) {
      return this.notApplicable(
        "No llms-full.txt at the site root. The file is optional, so its absence is not a defect.",
        "GET /llms-full.txt returns 200",
        rootArtifactMiss(result),
      );
    }

    return this.pass(
      "llms-full.txt exists and returns HTTP 200.",
      "HTTP 200",
      `HTTP ${result.status}`,
    );
  }
}
