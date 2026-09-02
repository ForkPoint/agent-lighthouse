import type { AuditMeta } from "../../types";
import type { CrawlerBot } from "./_robots-txt-helpers";
import { CrawlerBotAudit } from "./_crawler-bot-audit";
import { weightForGrade } from "../../scorer";

export class PerplexitybotAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/perplexitybot",
    category: "access-crawl-control",
    title: "PerplexityBot allowed",
    failureTitle: "PerplexityBot allowed",
    description:
      "Without an explicit robots.txt rule, PerplexityBot may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.",
    scoreDisplayMode: "ternary",
    weight: weightForGrade("A", "scored"),
    evidenceGrade: "A",
    tier: "scored",
    dossier: "docs/evidence/audits/access-crawl-control/perplexitybot.md",
    // Gate exemption: being refused is what this category reports.
    requires: ["origin-reachable"],
    defaultPriority: "medium",
    guidance: {
      impact:
        "Blocking PerplexityBot prevents your content from appearing in Perplexity AI search results, one of the fastest-growing AI answer engines. Allowing it gives your content visibility in AI-native search.",
      fix: "Add an explicit User-agent: PerplexityBot with Allow: / rule in your robots.txt file.",
      code: "User-agent: PerplexityBot\nAllow: /",
      effort: "trivial",
      docsUrl: "https://docs.perplexity.ai/guides/bots",
      tags: ["robots-txt", "perplexity", "crawler-permissions"],
    },
  };

  protected bot: CrawlerBot = {
    botName: "PerplexityBot",
    displayName: "PerplexityBot",
    category: "training",
  };
}
