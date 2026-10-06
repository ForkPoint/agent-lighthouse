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
      "Reads the robots.txt rules that apply to GPTBot — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants the same access.",
    scoreDisplayMode: "ternary",
    weight: weightForGrade("A", "scored"),
    evidenceGrade: "A",
    tier: "scored",
    dossier: "docs/evidence/audits/access-crawl-control/gptbot.md",
    // Gate exemption: being refused is what this category reports.
    requires: ["origin-reachable", "unblocked-fetches"],
    defaultPriority: "medium",
    guidance: {
      impact:
        "Blocking GPTBot prevents your content from being used by OpenAI's models and appearing in ChatGPT responses. Explicitly allowing it signals that your site welcomes AI indexing for the largest AI platform by user base.",
      fix: "If the block was not intended, remove the Disallow rule that applies to GPTBot. A named `User-agent: GPTBot` group with `Allow: /` also lifts it, but under RFC 9309 §2.2.1 a named group replaces the catch-all for that bot, so copy into it every catch-all Disallow line GPTBot should still obey.",
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
