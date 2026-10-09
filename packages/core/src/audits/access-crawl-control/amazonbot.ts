import type { AuditMeta } from "#core/types";
import type { CrawlerBot } from "./_robots-txt-helpers";
import { CrawlerBotAudit } from "./_crawler-bot-audit";
import { weightForGrade } from "#core/scorer";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
} from "#core/types";
import { CrawlerPurpose } from "./_robots-txt-helpers";

export class AmazonbotAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/amazonbot",
    category: "access-crawl-control",
    title: "Amazonbot allowed",
    failureTitle: "Amazonbot allowed",
    description:
      "Reads the robots.txt rules that apply to Amazonbot — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants the same access.",
    scoreDisplayMode: ScoreDisplayMode.Ternary,
    weight: weightForGrade(EvidenceGrade.A, AuditTier.Scored),
    evidenceGrade: EvidenceGrade.A,
    tier: AuditTier.Scored,
    dossier: "docs/evidence/audits/access-crawl-control/amazonbot.md",
    // Gate exemption: being refused is what this category reports.
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    defaultPriority: CheckPriority.Medium,
    guidance: {
      impact:
        "Blocking Amazonbot prevents your content from appearing in Alexa AI answers and Amazon's AI-powered search features. Allowing it gives your content visibility in Amazon's voice and commerce AI ecosystem.",
      fix: "If the block was not intended, remove the Disallow rule that applies to Amazonbot. A named `User-agent: Amazonbot` group with `Allow: /` also lifts it, but under RFC 9309 §2.2.1 a named group replaces the catch-all for that bot, so copy into it every catch-all Disallow line Amazonbot should still obey.",
      code: "User-agent: Amazonbot\nAllow: /",
      effort: FixEffort.Trivial,
      docsUrl: "https://developer.amazon.com/amazonbot",
      tags: ["robots-txt", "amazon", "crawler-permissions"],
    },
  };

  protected bot: CrawlerBot = {
    botName: "Amazonbot",
    displayName: "Amazonbot",
    category: CrawlerPurpose.Training,
  };
}
