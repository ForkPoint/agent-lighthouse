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

export class GoogleExtendedAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/google-extended",
    category: "access-crawl-control",
    title: "Google-Extended allowed",
    failureTitle: "Google-Extended allowed",
    description:
      "Google-Extended is a robots.txt usage-control token, not a crawler: no request carries it. This check reads the rules that apply to it — its own group if it has one, otherwise the catch-all — and reports whether they disallow the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants the same permission.",
    scoreDisplayMode: ScoreDisplayMode.Ternary,
    weight: weightForGrade(EvidenceGrade.A, AuditTier.Scored),
    evidenceGrade: EvidenceGrade.A,
    tier: AuditTier.Scored,
    dossier: "docs/evidence/audits/access-crawl-control/google-extended.md",
    // Gate exemption: being refused is what this category reports.
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    defaultPriority: CheckPriority.Medium,
    guidance: {
      impact:
        "Disallowing Google-Extended stops content Google already crawls from being used to train Gemini models and to ground answers in Gemini Apps and Vertex AI. It does not affect inclusion in Google Search, AI Overviews or AI Mode: Googlebot's own rules govern those.",
      fix: "If the block was not intended, remove the Disallow rule that applies to Google-Extended. A named `User-agent: Google-Extended` group with `Allow: /` also lifts it, but under RFC 9309 §2.2.1 a named group replaces the catch-all for that bot, so copy into it every catch-all Disallow line Google-Extended should still obey.",
      code: "User-agent: Google-Extended\nAllow: /",
      effort: FixEffort.Trivial,
      docsUrl:
        "https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers",
      tags: ["robots-txt", "google", "crawler-permissions"],
    },
  };

  protected bot: CrawlerBot = {
    botName: "Google-Extended",
    displayName: "Google-Extended",
    category: CrawlerPurpose.Training,
    controlToken: true,
  };
}
