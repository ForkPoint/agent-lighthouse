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

export class OaiSearchbotAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/oai-searchbot",
    category: "access-crawl-control",
    title: "OAI-SearchBot allowed",
    failureTitle: "OAI-SearchBot allowed",
    description:
      "Reads the robots.txt rules that apply to OAI-SearchBot — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants the same access.",
    scoreDisplayMode: ScoreDisplayMode.Ternary,
    weight: weightForGrade(EvidenceGrade.A, AuditTier.Scored),
    evidenceGrade: EvidenceGrade.A,
    tier: AuditTier.Scored,
    dossier: "docs/evidence/audits/access-crawl-control/oai-searchbot.md",
    // Gate exemption: being refused is what this category reports.
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    defaultPriority: CheckPriority.Medium,
    guidance: {
      impact:
        "Blocking OAI-SearchBot prevents your content from appearing in OpenAI's SearchGPT and ChatGPT web search results. Allowing it ensures your site is discoverable through OpenAI's real-time search features.",
      fix: "If the block was not intended, remove the Disallow rule that applies to OAI-SearchBot. A named `User-agent: OAI-SearchBot` group with `Allow: /` also lifts it, but under RFC 9309 §2.2.1 a named group replaces the catch-all for that bot, so copy into it every catch-all Disallow line OAI-SearchBot should still obey.",
      code: "User-agent: OAI-SearchBot\nAllow: /",
      effort: FixEffort.Trivial,
      docsUrl: "https://platform.openai.com/docs/bots/overview",
      tags: ["robots-txt", "openai", "realtime", "crawler-permissions"],
    },
  };

  protected bot: CrawlerBot = {
    botName: "OAI-SearchBot",
    displayName: "OAI-SearchBot",
    category: CrawlerPurpose.Realtime,
  };
}
