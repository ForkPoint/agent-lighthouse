import type { AuditMeta } from "#core/types";
import { ObsoleteRobotsGroupAudit } from "./_obsolete-robots-group-audit";
import { weightForGrade } from "#core/scorer";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  NoticeKind,
  ScoreDisplayMode,
} from "#core/types";

export class BravebotAudit extends ObsoleteRobotsGroupAudit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/bravebot",
    category: "access-crawl-control",
    // An obsolete audit speaks only when the owner wrote the group, so both
    // titles describe the group.
    title: "Bravebot robots.txt group (unread)",
    failureTitle: "A Bravebot robots.txt group that Brave does not read",
    description:
      "Reports a `User-agent: Bravebot` group in robots.txt. Brave documents that its search crawler does not advertise a distinct user agent and follows the rules that apply to Googlebot, so a group named for Bravebot governs nothing Brave sends.",
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: weightForGrade(EvidenceGrade.D, AuditTier.Obsolete),
    evidenceGrade: EvidenceGrade.D,
    tier: AuditTier.Obsolete,
    deprecated: {
      kind: NoticeKind.Obsolete,
      notice:
        "Brave says its crawler does not advertise a distinct user agent and does not crawl what Googlebot may not crawl, so a Bravebot group has no reader.",
      link: "https://search.brave.com/help/brave-search-crawler",
      replacement:
        "Control Brave Search through the rules that apply to Googlebot, and use a robots noindex directive to delist a page.",
    },
    dossier: "docs/evidence/audits/access-crawl-control/bravebot.md",
    // Gate exemption: being refused is what this category reports.
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    defaultPriority: CheckPriority.Low,
    guidance: {
      impact:
        "None in either direction. Brave does not send a Bravebot user agent, so the group neither admits nor blocks Brave; the Googlebot rules decide.",
      fix: "Nothing is required; the group can stay. To control Brave Search, set the rules that apply to Googlebot. To delist a page from Brave, use a robots noindex directive.",
      effort: FixEffort.Trivial,
      docsUrl: "https://search.brave.com/help/brave-search-crawler",
      tags: ["robots-txt", "brave", "obsolete"],
    },
  };

  protected readonly token = "Bravebot";
  protected readonly reason =
    'Brave says its crawler "does not advertise a differentiated user agent" and that a page not crawlable by Googlebot is not crawled by Brave either, so this group governs nothing Brave sends. Brave follows the rules that apply to Googlebot.';
}
