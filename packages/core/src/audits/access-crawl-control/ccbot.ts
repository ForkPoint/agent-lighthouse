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

export class CcbotAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/ccbot",
    category: "access-crawl-control",
    title: "CCBot allowed",
    failureTitle: "CCBot allowed",
    description:
      "Reads the robots.txt rules that apply to CCBot — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants the same access.",
    scoreDisplayMode: ScoreDisplayMode.Ternary,
    weight: weightForGrade(EvidenceGrade.A, AuditTier.Scored),
    evidenceGrade: EvidenceGrade.A,
    tier: AuditTier.Scored,
    dossier: "docs/evidence/audits/access-crawl-control/ccbot.md",
    // Gate exemption: being refused is what this category reports.
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    defaultPriority: CheckPriority.Medium,
    guidance: {
      impact:
        "Blocking CCBot prevents your content from being included in the Common Crawl dataset, which is a foundational training data source for many AI models. Allowing it broadens your content's reach across multiple AI systems.",
      fix: "If the block was not intended, remove the Disallow rule that applies to CCBot. A named `User-agent: CCBot` group with `Allow: /` also lifts it, but under RFC 9309 §2.2.1 a named group replaces the catch-all for that bot, so copy into it every catch-all Disallow line CCBot should still obey.",
      code: "User-agent: CCBot\nAllow: /",
      effort: FixEffort.Trivial,
      docsUrl: "https://commoncrawl.org/ccbot",
      tags: ["robots-txt", "common-crawl", "crawler-permissions"],
    },
  };

  protected bot: CrawlerBot = {
    botName: "CCBot",
    displayName: "CCBot",
    category: CrawlerPurpose.Training,
  };
}
