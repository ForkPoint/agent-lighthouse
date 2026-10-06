import type { AuditMeta } from "../../types";
import type { CrawlerBot } from "./_robots-txt-helpers";
import { CrawlerBotAudit } from "./_crawler-bot-audit";
import { weightForGrade } from "../../scorer";

export class MistralaiUserAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/mistralai-user",
    category: "access-crawl-control",
    title: "MistralAI-User allowed",
    failureTitle: "MistralAI-User allowed",
    description:
      "Reads the robots.txt rules that apply to MistralAI-User — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants the same access.",
    scoreDisplayMode: "ternary",
    weight: weightForGrade("A", "scored"),
    evidenceGrade: "A",
    tier: "scored",
    dossier: "docs/evidence/audits/access-crawl-control/mistralai-user.md",
    // Gate exemption: being refused is what this category reports.
    requires: ["origin-reachable", "unblocked-fetches"],
    defaultPriority: "medium",
    guidance: {
      impact:
        "Blocking MistralAI-User prevents Mistral AI's Le Chat from browsing your site in real-time when users ask it to visit your pages. Allowing it ensures your content can be cited in Mistral-powered AI conversations.",
      fix: "If the block was not intended, remove the Disallow rule that applies to MistralAI-User. A named `User-agent: MistralAI-User` group with `Allow: /` also lifts it, but under RFC 9309 §2.2.1 a named group replaces the catch-all for that bot, so copy into it every catch-all Disallow line MistralAI-User should still obey.",
      code: "User-agent: MistralAI-User\nAllow: /",
      effort: "trivial",
      tags: ["robots-txt", "mistral", "realtime", "crawler-permissions"],
    },
  };

  protected bot: CrawlerBot = {
    botName: "MistralAI-User",
    displayName: "MistralAI-User",
    category: "realtime",
  };
}
