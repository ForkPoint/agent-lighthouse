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

export class ClaudeUserAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/claude-user",
    category: "access-crawl-control",
    title: "Claude-User allowed",
    failureTitle: "Claude-User allowed",
    description:
      "Reads the robots.txt rules that apply to Claude-User — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants the same access.",
    scoreDisplayMode: ScoreDisplayMode.Ternary,
    weight: weightForGrade(EvidenceGrade.A, AuditTier.Scored),
    evidenceGrade: EvidenceGrade.A,
    tier: AuditTier.Scored,
    dossier: "docs/evidence/audits/access-crawl-control/claude-user.md",
    // Gate exemption: being refused is what this category reports.
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    defaultPriority: CheckPriority.Medium,
    guidance: {
      impact:
        "Blocking Claude-User prevents Claude from browsing your site in real-time when users ask it to visit your pages. This blocks your content from being cited in Claude conversations with web access enabled.",
      fix: "If the block was not intended, remove the Disallow rule that applies to Claude-User. A named `User-agent: Claude-User` group with `Allow: /` also lifts it, but under RFC 9309 §2.2.1 a named group replaces the catch-all for that bot, so copy into it every catch-all Disallow line Claude-User should still obey.",
      code: "User-agent: Claude-User\nAllow: /",
      effort: FixEffort.Trivial,
      tags: ["robots-txt", "anthropic", "realtime", "crawler-permissions"],
    },
  };

  protected bot: CrawlerBot = {
    botName: "Claude-User",
    displayName: "Claude-User",
    category: CrawlerPurpose.Realtime,
  };
}
