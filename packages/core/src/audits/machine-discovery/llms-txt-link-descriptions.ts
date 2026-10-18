import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import type { CheckContext } from "#core/check-context";
import { weightForGrade } from "#core/scorer";
import { extractMarkdownLinks } from "#core/parser";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
} from "#core/types";
import { isRootArtifact, rootArtifactMiss } from "#core/gatherers/root-files";
import { LLMS_TXT_NO_EFFECT, LLMS_TXT_NOTICE } from "./_llms-txt-notice";

export class LlmsTxtLinkDescriptionsAudit extends Audit {
  static override meta: AuditMeta = {
    id: "machine-discovery/llms-txt-link-descriptions",
    category: "machine-discovery",
    title: "llms.txt links include descriptions",
    failureTitle: "llms.txt links include descriptions",
    description:
      "The llms.txt format allows a short description after each link. Reports how many links carry one. No AI vendor documents reading llms.txt, so this check is reported and never scored.",
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: weightForGrade(EvidenceGrade.C, AuditTier.Informative),
    evidenceGrade: EvidenceGrade.C,
    tier: AuditTier.Informative,
    dossier:
      "docs/evidence/audits/machine-discovery/llms-txt-link-descriptions.md",
    deprecated: LLMS_TXT_NOTICE,
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    defaultPriority: CheckPriority.Low,
    guidance: {
      impact:
        "A description tells a reader of the file what each linked page covers. The format makes it optional, and no AI vendor documents reading llms.txt, so a missing description costs nothing with an AI agent.",
      fix: "Optional. If you publish an llms.txt, add a colon and a few words after each link URL saying what the page covers.",
      code: "- [Getting Started](/docs/start): Step-by-step guide for new users\n- [API Reference](/docs/api): Complete endpoint documentation\n- [Pricing](/pricing): Plans and pricing information",
      effort: FixEffort.Trivial,
      docsUrl: "https://llmstxt.org/",
      tags: ["llms-txt", "discoverability"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const result = ctx.rootFiles["/llms.txt"];

    if (!isRootArtifact(result)) {
      // No file, no link descriptions to read. Whether the file should exist
      // is llms-txt-exists' question, and that one answers not applicable.
      return this.notApplicable(
        "No llms.txt at the site root, so there are no link descriptions to check.",
        "Links follow - [Name](url): description",
        rootArtifactMiss(result),
      );
    }

    const links = extractMarkdownLinks(result.body);

    // Reported, never warned or failed: descriptions are optional in the
    // format and no AI vendor reads the file (policy.md, "Informative or
    // obsolete"). The counts stay in the message for anyone who wants them.
    if (links.length === 0) {
      return this.pass(
        `llms.txt contains no markdown links, so there are no descriptions to count; Chrome Lighthouse flags a file with no links. ${LLMS_TXT_NO_EFFECT}`,
        "Links follow - [Name](url): description pattern",
        "No links found",
      );
    }

    const withDescription = links.filter((l) => l.description.length > 0);

    if (withDescription.length < links.length) {
      return this.pass(
        `${withDescription.length}/${links.length} links have descriptions. ${LLMS_TXT_NO_EFFECT}`,
        "All links follow - [Name](url): description",
        `${withDescription.length}/${links.length} have descriptions`,
      );
    }

    return this.pass(
      `All ${links.length} links include descriptions.`,
      "All links have descriptions",
      `${links.length}/${links.length} have descriptions`,
    );
  }
}
