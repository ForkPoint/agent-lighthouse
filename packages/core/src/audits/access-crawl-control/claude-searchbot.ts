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

export class ClaudeSearchbotAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/claude-searchbot",
    category: "access-crawl-control",
    title: "Claude-SearchBot allowed",
    failureTitle: "Claude-SearchBot allowed",
    description:
      "Reads the robots.txt rules that apply to Claude-SearchBot — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants the same access.",
    scoreDisplayMode: ScoreDisplayMode.Ternary,
    weight: weightForGrade(EvidenceGrade.A, AuditTier.Scored),
    evidenceGrade: EvidenceGrade.A,
    tier: AuditTier.Scored,
    dossier: "docs/evidence/audits/access-crawl-control/claude-searchbot.md",
    // Gate exemption: being refused is what this category reports.
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    defaultPriority: CheckPriority.Medium,
    guidance: {
      impact:
        "Blocking Claude-SearchBot prevents your content from appearing in Claude's web search results. Allowing it ensures your site is included when Claude searches the web to answer user questions.",
      fix: "If the block was not intended, remove the Disallow rule that applies to Claude-SearchBot. A named `User-agent: Claude-SearchBot` group with `Allow: /` also lifts it, but under RFC 9309 §2.2.1 a named group replaces the catch-all for that bot, so copy into it every catch-all Disallow line Claude-SearchBot should still obey.",
      code: "User-agent: Claude-SearchBot\nAllow: /",
      effort: FixEffort.Trivial,
      tags: ["robots-txt", "anthropic", "realtime", "crawler-permissions"],
    },
  };

  protected bot: CrawlerBot = {
    botName: "Claude-SearchBot",
    displayName: "Claude-SearchBot",
    category: CrawlerPurpose.Realtime,
  };
}
