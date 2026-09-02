import type { AuditMeta } from "../../types";
import type { CrawlerBot } from "./_robots-txt-helpers";
import { CrawlerBotAudit } from "./_crawler-bot-audit";
import { weightForGrade } from "../../scorer";

export class CcbotAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/ccbot",
    category: "access-crawl-control",
    title: "CCBot allowed",
    failureTitle: "CCBot allowed",
    description:
      "Without an explicit robots.txt rule, CCBot may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.",
    scoreDisplayMode: "ternary",
    weight: weightForGrade("A", "scored"),
    evidenceGrade: "A",
    tier: "scored",
    dossier: "docs/evidence/audits/access-crawl-control/ccbot.md",
    // Gate exemption: being refused is what this category reports.
    requires: ["origin-reachable", "unblocked-fetches"],
    defaultPriority: "medium",
    guidance: {
      impact:
        "Blocking CCBot prevents your content from being included in the Common Crawl dataset, which is a foundational training data source for many AI models. Allowing it broadens your content's reach across multiple AI systems.",
      fix: "Add an explicit User-agent: CCBot with Allow: / rule in your robots.txt file.",
      code: "User-agent: CCBot\nAllow: /",
      effort: "trivial",
      docsUrl: "https://commoncrawl.org/ccbot",
      tags: ["robots-txt", "common-crawl", "crawler-permissions"],
    },
  };

  protected bot: CrawlerBot = {
    botName: "CCBot",
    displayName: "CCBot",
    category: "training",
  };
}
