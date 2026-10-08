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

export class ChatgptUserAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/chatgpt-user",
    category: "access-crawl-control",
    title: "ChatGPT-User allowed",
    failureTitle: "ChatGPT-User allowed",
    description:
      "Reads the robots.txt rules that apply to ChatGPT-User — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants the same access.",
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: weightForGrade(EvidenceGrade.C, AuditTier.Informative),
    evidenceGrade: EvidenceGrade.C,
    tier: AuditTier.Informative,
    dossier: "docs/evidence/audits/access-crawl-control/chatgpt-user.md",
    // Gate exemption: being refused is what this category reports.
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    defaultPriority: CheckPriority.Medium,
    guidance: {
      impact:
        "Blocking ChatGPT-User prevents ChatGPT from browsing your site in real-time when users ask it to visit your pages. This blocks your content from being cited in ChatGPT Browse conversations, losing a significant source of AI-driven traffic.",
      fix: "If the block was not intended, remove the Disallow rule that applies to ChatGPT-User. A named `User-agent: ChatGPT-User` group with `Allow: /` also lifts it, but under RFC 9309 §2.2.1 a named group replaces the catch-all for that bot, so copy into it every catch-all Disallow line ChatGPT-User should still obey.",
      code: "User-agent: ChatGPT-User\nAllow: /",
      effort: FixEffort.Trivial,
      docsUrl: "https://platform.openai.com/docs/bots/overview",
      tags: ["robots-txt", "openai", "realtime", "crawler-permissions"],
    },
  };

  protected bot: CrawlerBot = {
    botName: "ChatGPT-User",
    displayName: "ChatGPT-User",
    category: CrawlerPurpose.Realtime,
  };
}
