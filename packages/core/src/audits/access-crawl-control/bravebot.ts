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
      "Reports a `User-agent: Bravebot` group in robots.txt. Brave documents that its search crawler does not advertise a distinct user agent and follows the rules that apply to Googlebot. It does not document reading a Bravebot group.",
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: weightForGrade(EvidenceGrade.D, AuditTier.Obsolete),
    evidenceGrade: EvidenceGrade.D,
    tier: AuditTier.Obsolete,
    deprecated: {
      kind: NoticeKind.Obsolete,
      notice:
        "Brave documents following the Googlebot rules: its crawler does not advertise a distinct user agent and does not crawl what Googlebot may not crawl. Brave does not document reading a Bravebot group.",
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
        "Likely none. Brave documents following the Googlebot rules and does not document reading a Bravebot group, so the Googlebot rules are the control Brave describes.",
      fix: "Nothing is required; the group can stay. To control Brave Search, set the rules that apply to Googlebot. To delist a page from Brave, use a robots noindex directive.",
      effort: FixEffort.Trivial,
      docsUrl: "https://search.brave.com/help/brave-search-crawler",
      tags: ["robots-txt", "brave", "obsolete"],
    },
  };

  protected readonly token = "Bravebot";
  protected readonly reason =
    'Brave documents following the Googlebot rules: its crawler "does not advertise a differentiated user agent", and a page not crawlable by Googlebot is not crawled by Brave either. Brave does not document reading a Bravebot group.';
}
