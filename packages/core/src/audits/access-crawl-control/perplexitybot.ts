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

export class PerplexitybotAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/perplexitybot",
    category: "access-crawl-control",
    title: "PerplexityBot allowed",
    failureTitle: "PerplexityBot allowed",
    description:
      "Reads the robots.txt rules that apply to PerplexityBot — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants the same access.",
    scoreDisplayMode: ScoreDisplayMode.Ternary,
    weight: weightForGrade(EvidenceGrade.A, AuditTier.Scored),
    evidenceGrade: EvidenceGrade.A,
    tier: AuditTier.Scored,
    dossier: "docs/evidence/audits/access-crawl-control/perplexitybot.md",
    // Gate exemption: being refused is what this category reports.
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    defaultPriority: CheckPriority.Medium,
    guidance: {
      impact:
        "Blocking PerplexityBot prevents your content from appearing in Perplexity AI search results, one of the fastest-growing AI answer engines. Allowing it gives your content visibility in AI-native search.",
      fix: "If the block was not intended, remove the Disallow rule that applies to PerplexityBot. A named `User-agent: PerplexityBot` group with `Allow: /` also lifts it, but under RFC 9309 §2.2.1 a named group replaces the catch-all for that bot, so copy into it every catch-all Disallow line PerplexityBot should still obey.",
      code: "User-agent: PerplexityBot\nAllow: /",
      effort: FixEffort.Trivial,
      docsUrl: "https://docs.perplexity.ai/guides/bots",
      tags: ["robots-txt", "perplexity", "crawler-permissions"],
    },
  };

  protected bot: CrawlerBot = {
    botName: "PerplexityBot",
    displayName: "PerplexityBot",
    category: CrawlerPurpose.Training,
  };
}
