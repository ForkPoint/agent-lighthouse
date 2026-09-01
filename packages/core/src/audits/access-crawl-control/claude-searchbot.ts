import type { AuditMeta } from "../../types";
import type { CrawlerBot } from "./_robots-txt-helpers";
import { CrawlerBotAudit } from "./_crawler-bot-audit";
import { weightForGrade } from "../../scorer";

export class ClaudeSearchbotAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/claude-searchbot",
    category: "access-crawl-control",
    title: "Claude-SearchBot allowed",
    failureTitle: "Claude-SearchBot allowed",
    description:
      "Without an explicit robots.txt rule, Claude-SearchBot may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.",
    scoreDisplayMode: "ternary",
    weight: weightForGrade("A", "scored"),
    evidenceGrade: "A",
    tier: "scored",
    dossier: "docs/evidence/audits/access-crawl-control/claude-searchbot.md",
    // Gate exemption: being refused is what this category reports.
    requires: ["origin-reachable"],
    defaultPriority: "medium",
    guidance: {
      impact:
        "Blocking Claude-SearchBot prevents your content from appearing in Claude's web search results. Allowing it ensures your site is included when Claude searches the web to answer user questions.",
      fix: "Add an explicit User-agent: Claude-SearchBot with Allow: / rule in your robots.txt file.",
      code: "User-agent: Claude-SearchBot\nAllow: /",
      effort: "trivial",
      tags: ["robots-txt", "anthropic", "realtime", "crawler-permissions"],
    },
  };

  protected bot: CrawlerBot = {
    botName: "Claude-SearchBot",
    displayName: "Claude-SearchBot",
    category: "realtime",
  };
}
