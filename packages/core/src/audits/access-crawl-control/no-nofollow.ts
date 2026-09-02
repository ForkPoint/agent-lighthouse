import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from "../../check-context";
import { weightForGrade } from "../../scorer";

export class NoNofollowAudit extends Audit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/no-nofollow",
    category: "access-crawl-control",
    title: "No nofollow on important links",
    failureTitle: "No nofollow on important links",
    description:
      "A site-wide nofollow directive prevents AI crawlers from following links to discover your content. Important internal links should be followable.",
    scoreDisplayMode: "ternary",
    weight: weightForGrade("A", "scored"),
    evidenceGrade: "A",
    tier: "scored",
    dossier: "docs/evidence/audits/access-crawl-control/no-nofollow.md",
    // Gate exemption: being refused is what this category reports, and the meta tag and
    // header this audit reads are served by a page whose body renders nothing.
    requires: ["origin-reachable", "unblocked-fetches"],
    defaultPriority: "high",
    guidance: {
      impact:
        "A nofollow directive prevents AI crawlers from following links on your pages, effectively hiding all linked content from AI indexing. Your deeper pages become invisible to AI search engines, drastically reducing discoverability.",
      fix: 'Remove nofollow from your meta robots tag and X-Robots-Tag header on important pages. Use "index, follow" to allow full crawling. Reserve nofollow only for untrusted external links.',
      code: '<!-- Allow crawlers to follow links -->\n<meta name="robots" content="index, follow" />',
      effort: "trivial",
      docsUrl:
        "https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag",
      tags: ["robots", "seo", "discoverability"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    if (ctx.pages.length === 0) {
      return this.fail(
        "No pages scanned.",
        "No site-wide nofollow directives",
        "No pages scanned",
        {
          priority: "high",
          description: NoNofollowAudit.meta.description,
        },
      );
    }

    const pagesWithNofollow: string[] = [];

    for (const page of ctx.pages) {
      // Check meta robots tag for nofollow
      const metaRobots = (page.meta["robots"] ?? "").toLowerCase();
      const hasMetaNofollow = metaRobots.includes("nofollow");

      // Check X-Robots-Tag header for nofollow
      const xRobotsTag = (
        page.fetchResult.headers["x-robots-tag"] ?? ""
      ).toLowerCase();
      const hasHeaderNofollow = xRobotsTag.includes("nofollow");

      if (hasMetaNofollow || hasHeaderNofollow) {
        pagesWithNofollow.push(page.url);
      }
    }

    if (pagesWithNofollow.length === ctx.pages.length) {
      return this.fail(
        `All ${ctx.pages.length} scanned page(s) have nofollow directives.`,
        "No site-wide nofollow directives",
        `${pagesWithNofollow.length}/${ctx.pages.length} pages have nofollow`,
        {
          priority: "high",
          description:
            "All your scanned pages have nofollow directives, which prevents AI crawlers from discovering linked content. Remove nofollow from important pages to allow full content discovery.",
          code: `<!-- Allow crawlers to follow links -->\n<meta name="robots" content="index, follow" />`,
        },
        pagesWithNofollow[0],
      );
    }

    if (pagesWithNofollow.length > 0) {
      return this.warn(
        `${pagesWithNofollow.length}/${ctx.pages.length} page(s) have nofollow directives.`,
        "No nofollow on important pages",
        `Nofollow on: ${pagesWithNofollow.slice(0, 5).join(", ")}${pagesWithNofollow.length > 5 ? ` (+${pagesWithNofollow.length - 5} more)` : ""}`,
        {
          priority: "medium",
          description:
            "Some pages have nofollow directives that prevent AI crawlers from following their links. Review whether these pages need nofollow or if it can be removed to improve content discovery.",
          code: `<!-- Allow crawlers to follow links -->\n<meta name="robots" content="index, follow" />`,
        },
        pagesWithNofollow[0],
      );
    }

    return this.pass(
      "No scanned pages have nofollow directives.",
      "No nofollow on important pages",
      `${ctx.pages.length} page(s) checked`,
    );
  }
}
