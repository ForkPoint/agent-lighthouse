import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from "../../check-context";
import { weightForGrade } from "../../scorer";

export class NoNofollowAudit extends Audit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/no-nofollow",
    category: "access-crawl-control",
    title: "Page-level nofollow directives",
    failureTitle: "Page-level nofollow directives",
    description:
      "Checks for page-level nofollow in robots metadata and X-Robots-Tag headers across the scanned pages. This check does not inspect individual links.",
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
        "Applebot documents that page-level nofollow prevents it from following links on that page. This does not prove that the linked pages are undiscoverable through other sources or that every AI crawler honors the directive.",
      fix: "Review whether each affected page should allow link traversal. If so, remove nofollow from its robots meta tag or X-Robots-Tag header. Keep intentional restrictions.",
      code: '<!-- Allow crawlers to follow links -->\n<meta name="robots" content="index, follow" />',
      effort: "trivial",
      docsUrl:
        "https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag",
      tags: ["robots", "seo", "discoverability"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    if (ctx.pages.length === 0) {
      return this.notApplicable(
        "No pages scanned, so no page-level nofollow directives can be checked.",
        "No page-level nofollow directives on pages intended for link traversal",
        "No pages scanned",
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

    pagesWithNofollow.sort();
    const found = `${pagesWithNofollow.length}/${ctx.pages.length} pages have nofollow. Nofollow on: ${pagesWithNofollow.slice(0, 5).join(", ")}${pagesWithNofollow.length > 5 ? ` (+${pagesWithNofollow.length - 5} more)` : ""}`;

    if (pagesWithNofollow.length === ctx.pages.length) {
      return this.validate(
        this.fail(
          `All ${ctx.pages.length} scanned page(s) have nofollow directives.`,
          "No page-level nofollow directives on pages intended for link traversal",
          found,
          {
            priority: "high",
            description: NoNofollowAudit.meta.guidance!.fix,
            code: `<!-- Allow crawlers to follow links -->\n<meta name="robots" content="index, follow" />`,
          },
          pagesWithNofollow[0],
        ),
      );
    }

    if (pagesWithNofollow.length > 0) {
      return this.validate(
        this.warn(
          `${pagesWithNofollow.length}/${ctx.pages.length} page(s) have nofollow directives.`,
          "No page-level nofollow directives on pages intended for link traversal",
          found,
          {
            priority: "medium",
            description: NoNofollowAudit.meta.guidance!.fix,
            code: `<!-- Allow crawlers to follow links -->\n<meta name="robots" content="index, follow" />`,
          },
          pagesWithNofollow[0],
        ),
      );
    }

    return this.pass(
      "No scanned pages have nofollow directives.",
      "No page-level nofollow directives on pages intended for link traversal",
      `${ctx.pages.length} page(s) checked`,
    );
  }
}
