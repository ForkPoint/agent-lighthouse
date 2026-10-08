import type { AuditMeta } from "../../types";
import type { CrawlerBot } from "./_robots-txt-helpers";
import { CrawlerBotAudit } from "./_crawler-bot-audit";
import { weightForGrade } from "../../scorer";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
} from "../../types";
import { CrawlerPurpose } from "./_robots-txt-helpers";

export class BravebotAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/bravebot",
    category: "access-crawl-control",
    title: "Bravebot allowed",
    failureTitle: "Bravebot allowed",
    description:
      "Reads the robots.txt rules that apply to Bravebot — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants the same access.",
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: weightForGrade(EvidenceGrade.C, AuditTier.Informative),
    evidenceGrade: EvidenceGrade.C,
    tier: AuditTier.Informative,
    dossier: "docs/evidence/audits/access-crawl-control/bravebot.md",
    // Gate exemption: being refused is what this category reports.
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    defaultPriority: CheckPriority.Medium,
    guidance: {
      impact:
        "Blocking Bravebot prevents your content from appearing in Brave Search AI answers and Brave Leo AI assistant responses. Allowing it gives your content visibility in the privacy-focused Brave browser ecosystem.",
      fix: "If the block was not intended, remove the Disallow rule that applies to Bravebot. A named `User-agent: Bravebot` group with `Allow: /` also lifts it, but under RFC 9309 §2.2.1 a named group replaces the catch-all for that bot, so copy into it every catch-all Disallow line Bravebot should still obey.",
      code: "User-agent: Bravebot\nAllow: /",
      effort: FixEffort.Trivial,
      tags: ["robots-txt", "brave", "realtime", "crawler-permissions"],
    },
  };

  protected bot: CrawlerBot = {
    botName: "Bravebot",
    displayName: "Bravebot",
    category: CrawlerPurpose.Realtime,
  };
}
