import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from "../../check-context";
import { weightForGrade } from "../../scorer";
import { readSitemap, NO_SITEMAP } from "../../gatherers/sitemap";

export class SitemapAbsoluteUrlsAudit extends Audit {
  static override meta: AuditMeta = {
    id: "machine-discovery/sitemap-absolute-urls",
    category: "machine-discovery",
    title: "Sitemap uses absolute URLs",
    failureTitle: "Sitemap uses absolute URLs",
    description:
      "Sitemap URLs must be absolute (starting with https://) so AI crawlers can resolve them without ambiguity.",
    scoreDisplayMode: "binary",
    weight: weightForGrade("B", "scored"),
    evidenceGrade: "B",
    tier: "scored",
    dossier: "docs/evidence/audits/machine-discovery/sitemap-absolute-urls.md",
    requires: ["origin-reachable", "unblocked-fetches"],
    defaultPriority: "high",
    guidance: {
      impact:
        "Relative URLs in your sitemap cannot be resolved by AI crawlers, causing them to silently skip those pages. Any page listed with a relative URL is effectively invisible to AI search engines.",
      fix: "Ensure every <loc> value in your sitemap.xml starts with the full protocol and domain (e.g., https://yoursite.com/page). Update your sitemap generator configuration to output absolute URLs.",
      code: "<!-- Correct: absolute URL -->\n<url>\n  <loc>https://yoursite.com/page</loc>\n</url>\n\n<!-- Wrong: relative URL -->\n<url>\n  <loc>/page</loc>\n</url>",
      effort: "trivial",
      docsUrl: "https://www.sitemaps.org/protocol.html",
      tags: ["sitemap", "seo", "discoverability"],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const sitemap = await readSitemap(ctx);

    if (sitemap.kind === "absent" || sitemap.kind === "empty") {
      return this.notApplicable(
        NO_SITEMAP,
        "All <loc> values are absolute URLs",
        "No sitemap entries found",
      );
    }

    if (sitemap.kind === "malformed") {
      return this.fail(
        "Sitemap file found but does not contain valid <urlset> or <sitemapindex>.",
        "All <loc> values are absolute URLs",
        "Malformed sitemap XML",
      );
    }

    const locs = sitemap.tree.entries.map((e) => e.loc).filter(Boolean);

    if (locs.length === 0) {
      return this.notApplicable(
        NO_SITEMAP,
        "All <loc> values are absolute URLs",
        "No <loc> entries found",
      );
    }

    const relative = locs.filter(
      (loc) => !loc.startsWith("http://") && !loc.startsWith("https://"),
    );

    if (relative.length > 0) {
      return this.fail(
        `${relative.length}/${locs.length} <loc> value(s) use relative URLs.`,
        "All <loc> values are absolute URLs (https://...)",
        `Relative: ${relative.slice(0, 5).join(", ")}${relative.length > 5 ? ` (+${relative.length - 5} more)` : ""}`,
        {
          priority: "high",
          description:
            "Sitemap URLs must be absolute (starting with http:// or https://) per the sitemaps.org protocol. Relative URLs cannot be resolved by AI crawlers and will be ignored.",
          code: `<!-- Use absolute URLs -->\n<url>\n  <loc>https://yoursite.com/page</loc>\n</url>\n\n<!-- NOT relative URLs -->\n<url>\n  <loc>/page</loc> <!-- WRONG -->\n</url>`,
        },
      );
    }

    return this.pass(
      `All ${locs.length} <loc> value(s) use absolute URLs.`,
      "All <loc> values are absolute URLs",
      `${locs.length} absolute URL(s)`,
    );
  }
}
