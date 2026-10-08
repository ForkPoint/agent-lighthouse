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

export class MetaExternalFetcherAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/meta-external-fetcher",
    category: "access-crawl-control",
    title: "Meta-ExternalFetcher allowed",
    failureTitle: "Meta-ExternalFetcher allowed",
    description:
      "Reads the robots.txt rules that apply to Meta-ExternalFetcher — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants the same access.",
    scoreDisplayMode: ScoreDisplayMode.Ternary,
    weight: weightForGrade(EvidenceGrade.A, AuditTier.Scored),
    evidenceGrade: EvidenceGrade.A,
    tier: AuditTier.Scored,
    dossier:
      "docs/evidence/audits/access-crawl-control/meta-external-fetcher.md",
    // Gate exemption: being refused is what this category reports.
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    defaultPriority: CheckPriority.Medium,
    guidance: {
      impact:
        "Blocking Meta-ExternalFetcher prevents Meta's AI from fetching your content in real-time for AI-powered features across Facebook, Instagram, and WhatsApp. Allowing it ensures your content can be surfaced in Meta's real-time AI experiences.",
      fix: "If the block was not intended, remove the Disallow rule that applies to Meta-ExternalFetcher. A named `User-agent: Meta-ExternalFetcher` group with `Allow: /` also lifts it, but under RFC 9309 §2.2.1 a named group replaces the catch-all for that bot, so copy into it every catch-all Disallow line Meta-ExternalFetcher should still obey.",
      code: "User-agent: Meta-ExternalFetcher\nAllow: /",
      effort: FixEffort.Trivial,
      tags: ["robots-txt", "meta", "realtime", "crawler-permissions"],
    },
  };

  protected bot: CrawlerBot = {
    botName: "Meta-ExternalFetcher",
    displayName: "Meta-ExternalFetcher",
    category: CrawlerPurpose.Realtime,
  };
}
