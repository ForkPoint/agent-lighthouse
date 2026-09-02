import type { AuditMeta } from "../../types";
import type { CrawlerBot } from "./_robots-txt-helpers";
import { CrawlerBotAudit } from "./_crawler-bot-audit";
import { weightForGrade } from "../../scorer";

export class MetaExternalFetcherAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/meta-external-fetcher",
    category: "access-crawl-control",
    title: "Meta-ExternalFetcher allowed",
    failureTitle: "Meta-ExternalFetcher allowed",
    description:
      "Without an explicit robots.txt rule, Meta-ExternalFetcher may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.",
    scoreDisplayMode: "ternary",
    weight: weightForGrade("A", "scored"),
    evidenceGrade: "A",
    tier: "scored",
    dossier:
      "docs/evidence/audits/access-crawl-control/meta-external-fetcher.md",
    // Gate exemption: being refused is what this category reports.
    requires: ["origin-reachable", "unblocked-fetches"],
    defaultPriority: "medium",
    guidance: {
      impact:
        "Blocking Meta-ExternalFetcher prevents Meta's AI from fetching your content in real-time for AI-powered features across Facebook, Instagram, and WhatsApp. Allowing it ensures your content can be surfaced in Meta's real-time AI experiences.",
      fix: "Add an explicit User-agent: Meta-ExternalFetcher with Allow: / rule in your robots.txt file.",
      code: "User-agent: Meta-ExternalFetcher\nAllow: /",
      effort: "trivial",
      tags: ["robots-txt", "meta", "realtime", "crawler-permissions"],
    },
  };

  protected bot: CrawlerBot = {
    botName: "Meta-ExternalFetcher",
    displayName: "Meta-ExternalFetcher",
    category: "realtime",
  };
}
