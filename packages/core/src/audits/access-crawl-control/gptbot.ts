import type { AuditMeta } from "../../types";
import type { CrawlerBot } from "./_robots-txt-helpers";
import { CrawlerBotAudit } from "./_crawler-bot-audit";
import { weightForGrade } from "../../scorer";

export class GptbotAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/gptbot",
    category: "access-crawl-control",
    title: "GPTBot allowed",
    failureTitle: "GPTBot allowed",
    description:
      "Without an explicit robots.txt rule, GPTBot may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.",
    scoreDisplayMode: "ternary",
    weight: weightForGrade("A", "scored"),
    evidenceGrade: "A",
    tier: "scored",
    dossier: "docs/evidence/audits/access-crawl-control/gptbot.md",
    // Gate exemption: being refused is what this category reports.
    requires: ["origin-reachable"],
    defaultPriority: "medium",
    guidance: {
      impact:
        "Blocking GPTBot prevents your content from being used by OpenAI's models and appearing in ChatGPT responses. Explicitly allowing it signals that your site welcomes AI indexing for the largest AI platform by user base.",
      fix: "Add an explicit User-agent: GPTBot with Allow: / rule in your robots.txt file.",
      code: "User-agent: GPTBot\nAllow: /",
      effort: "trivial",
      docsUrl: "https://platform.openai.com/docs/bots/overview",
      tags: ["robots-txt", "openai", "crawler-permissions"],
    },
  };

  protected bot: CrawlerBot = {
    botName: "GPTBot",
    displayName: "GPTBot",
    category: "training",
  };
}
