import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from "../../check-context";
import { parseRobotsTxt, isPathAllowed } from "./_robots-txt-helpers";
import { weightForGrade } from "../../scorer";

export class NoBlanketBlockAudit extends Audit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/no-blanket-block",
    category: "access-crawl-control",
    title: "No blanket AI block",
    failureTitle: "No blanket AI block",
    description:
      "A blanket Disallow: / under User-agent: * blocks every crawler, including all AI agents. Your site becomes invisible to AI search engines, ChatGPT Browse, Perplexity, and others.",
    scoreDisplayMode: "ternary",
    weight: weightForGrade("B", "scored"),
    evidenceGrade: "B",
    tier: "scored",
    dossier: "docs/evidence/audits/access-crawl-control/no-blanket-block.md",
    // Gate exemption: being refused is what this category reports.
    requires: ["origin-reachable", "unblocked-fetches"],
    defaultPriority: "critical",
    guidance: {
      impact:
        "A blanket Disallow: / under User-agent: * blocks every crawler, including all AI agents. Your site becomes completely invisible to AI search engines, ChatGPT Browse, Perplexity, Claude, and all other AI-powered discovery tools.",
      fix: "Replace the blanket Disallow: / with targeted path blocks for sensitive areas only. Allow the root path and block only private directories like /api/ and /admin/.",
      code: "User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/\nDisallow: /internal/",
      effort: "trivial",
      docsUrl:
        "https://developers.google.com/search/docs/crawling-indexing/robots/intro",
      tags: ["robots-txt", "critical", "crawler-permissions"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const robotsFile = ctx.rootFiles["/robots.txt"];

    if (!robotsFile || robotsFile.status !== 200 || !robotsFile.body) {
      return this.warn(
        "No robots.txt found — cannot verify crawler permissions.",
        "User-agent: * does not Disallow: / entirely",
        "No robots.txt found",
        {
          priority: "medium",
          description:
            "Without a robots.txt file, there is no way to verify whether crawler permissions are correctly configured. Create a robots.txt file with explicit rules for AI crawlers.",
          code: "User-agent: *\nAllow: /",
        },
      );
    }

    const groups = parseRobotsTxt(robotsFile.body);
    // Group selection and longest-match resolution both come from the shared
    // RFC 9309 gatherer: `isPathAllowed` picks the `*` groups itself, so the
    // audit no longer filters and flattens the rule list by hand.
    const blocked = !isPathAllowed(groups, "*", "/");

    if (blocked) {
      return this.fail(
        "User-agent: * has Disallow: / — this blocks all crawlers including AI agents.",
        "User-agent: * does not Disallow: / entirely",
        "User-agent: * contains Disallow: /",
        {
          priority: "critical",
          description:
            "A blanket Disallow: / under User-agent: * blocks every crawler, including all AI agents. Your site becomes invisible to AI search engines, ChatGPT Browse, Perplexity, and others. Replace it with targeted path blocks for sensitive areas only.",
          code: "User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/\nDisallow: /internal/",
        },
      );
    }

    return this.pass(
      "No blanket Disallow: / found for User-agent: *.",
      "User-agent: * does not Disallow: / entirely",
      "Wildcard user-agent does not block all paths",
    );
  }
}
