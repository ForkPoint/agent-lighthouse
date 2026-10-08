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

export class DuckassistbotAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/duckassistbot",
    category: "access-crawl-control",
    title: "DuckAssistBot allowed",
    failureTitle: "DuckAssistBot allowed",
    description:
      "Reads the robots.txt rules that apply to DuckAssistBot — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants the same access.",
    scoreDisplayMode: ScoreDisplayMode.Ternary,
    weight: weightForGrade(EvidenceGrade.A, AuditTier.Scored),
    evidenceGrade: EvidenceGrade.A,
    tier: AuditTier.Scored,
    dossier: "docs/evidence/audits/access-crawl-control/duckassistbot.md",
    // Gate exemption: being refused is what this category reports.
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    defaultPriority: CheckPriority.Medium,
    guidance: {
      impact:
        "Blocking DuckAssistBot prevents your content from appearing in DuckDuckGo's AI-powered DuckAssist feature, which generates instant answers from crawled web pages. Allowing it ensures visibility in this privacy-first AI search experience.",
      fix: "If the block was not intended, remove the Disallow rule that applies to DuckAssistBot. A named `User-agent: DuckAssistBot` group with `Allow: /` also lifts it, but under RFC 9309 §2.2.1 a named group replaces the catch-all for that bot, so copy into it every catch-all Disallow line DuckAssistBot should still obey.",
      code: "User-agent: DuckAssistBot\nAllow: /",
      effort: FixEffort.Trivial,
      tags: ["robots-txt", "duckduckgo", "realtime", "crawler-permissions"],
    },
  };

  protected bot: CrawlerBot = {
    botName: "DuckAssistBot",
    displayName: "DuckAssistBot",
    category: CrawlerPurpose.Realtime,
  };
}
