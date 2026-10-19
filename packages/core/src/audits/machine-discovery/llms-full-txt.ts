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
import { LLMS_FULL_TXT_NO_EFFECT, LLMS_TXT_NOTICE } from "./_llms-txt-notice";

export class LlmsFullTxtAudit extends Audit {
  static override meta: AuditMeta = {
    id: "machine-discovery/llms-full-txt",
    category: "machine-discovery",
    title: "llms-full.txt present",
    failureTitle: "llms-full.txt present",
    description:
      "llms-full.txt is a companion convention to llms.txt: the site's content in one markdown file. No AI vendor documents reading it from a website, so this check reports whether the file is served and never scores it.",
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: weightForGrade(EvidenceGrade.C, AuditTier.Informative),
    evidenceGrade: EvidenceGrade.C,
    tier: AuditTier.Informative,
    dossier: "docs/evidence/audits/machine-discovery/llms-full-txt.md",
    deprecated: LLMS_TXT_NOTICE,
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    defaultPriority: CheckPriority.Low,
    guidance: {
      impact:
        "No AI vendor documents fetching llms-full.txt from a website; crawlers and assistants read the pages themselves. Tools a user points at the file, such as documentation helpers in coding agents, may read it.",
      fix: "Optional. Publish /llms-full.txt only if documentation tools your users run are a use case: the full text of your important pages in markdown, one file.",
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
      `llms-full.txt exists and returns HTTP 200. ${LLMS_FULL_TXT_NO_EFFECT}`,
      "HTTP 200",
      `HTTP ${result.status}`,
    );
  }
}
