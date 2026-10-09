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

export class ApplebotExtendedAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/applebot-extended",
    category: "access-crawl-control",
    title: "Applebot-Extended allowed",
    failureTitle: "Applebot-Extended allowed",
    description:
      "Applebot-Extended is a robots.txt usage-control token, not a crawler: no request carries it. This check reads the rules that apply to it — its own group if it has one, otherwise the catch-all — and reports whether they disallow the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants the same permission.",
    scoreDisplayMode: ScoreDisplayMode.Ternary,
    weight: weightForGrade(EvidenceGrade.A, AuditTier.Scored),
    evidenceGrade: EvidenceGrade.A,
    tier: AuditTier.Scored,
    dossier: "docs/evidence/audits/access-crawl-control/applebot-extended.md",
    // Gate exemption: being refused is what this category reports.
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    defaultPriority: CheckPriority.Medium,
    guidance: {
      impact:
        "Disallowing Applebot-Extended opts content Applebot already crawls out of training Apple's foundation models. It does not remove the site from Siri, Spotlight or Safari search results: base Applebot governs those.",
      fix: "If the block was not intended, remove the Disallow rule that applies to Applebot-Extended. A named `User-agent: Applebot-Extended` group with `Allow: /` also lifts it, but under RFC 9309 §2.2.1 a named group replaces the catch-all for that bot, so copy into it every catch-all Disallow line Applebot-Extended should still obey.",
      code: "User-agent: Applebot-Extended\nAllow: /",
      effort: FixEffort.Trivial,
      docsUrl: "https://support.apple.com/en-us/111042",
      tags: ["robots-txt", "apple", "crawler-permissions"],
    },
  };

  protected bot: CrawlerBot = {
    botName: "Applebot-Extended",
    displayName: "Applebot-Extended",
    category: CrawlerPurpose.Training,
    controlToken: true,
  };
}
