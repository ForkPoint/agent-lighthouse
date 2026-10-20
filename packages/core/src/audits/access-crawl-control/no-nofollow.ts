import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import type { CheckContext, PageContext } from "#core/check-context";
import { weightForGrade } from "#core/scorer";
import {
  DOCUMENTED_ROBOTS_NAMES,
  parseXRobotsTag,
} from "#core/robots-meta-names";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
} from "#core/types";

const NOFOLLOW = "nofollow";

/**
 * True when a robots meta tag or `X-Robots-Tag` directive under a name an
 * operator documents reading carries `nofollow`.
 *
 * Meta tags are read off the DOM, so every tag counts rather than the last
 * one. A header `bot:` prefix scopes every directive after it, so
 * `X-Robots-Tag: gptbot: nofollow` binds only a crawler that documents no
 * such reading, and does not count as nofollow for every crawler.
 */
function hasNofollow(page: PageContext): boolean {
  const $ = page.$;
  let found = false;
  $("meta[name]").each((_, el) => {
    if (found) return;
    const name = ($(el).attr("name") ?? "").trim().toLowerCase();
    if (!DOCUMENTED_ROBOTS_NAMES.has(name)) return;
    found = ($(el).attr("content") ?? "")
      .split(",")
      .some((token) => token.trim().toLowerCase() === NOFOLLOW);
  });
  if (found) return true;
  return parseXRobotsTag(page.fetchResult.headers["x-robots-tag"]).some(
    ({ name, token }) =>
      DOCUMENTED_ROBOTS_NAMES.has(name) && token === NOFOLLOW,
  );
}

export class NoNofollowAudit extends Audit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/no-nofollow",
    category: "access-crawl-control",
    title: "Page-level nofollow directives",
    failureTitle: "Page-level nofollow directives",
    description:
      "Checks for page-level nofollow in robots metadata and X-Robots-Tag headers across the scanned pages. This check does not inspect individual links.",
    scoreDisplayMode: ScoreDisplayMode.Ternary,
    weight: weightForGrade(EvidenceGrade.A, AuditTier.Scored),
    evidenceGrade: EvidenceGrade.A,
    tier: AuditTier.Scored,
    dossier: "docs/evidence/audits/access-crawl-control/no-nofollow.md",
    // Gate exemption: being refused is what this category reports, and the meta tag and
    // header this audit reads are served by a page whose body renders nothing.
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    defaultPriority: CheckPriority.High,
    guidance: {
      impact:
        "Applebot documents that page-level nofollow prevents it from following links on that page. This does not prove that the linked pages are undiscoverable through other sources or that every AI crawler honors the directive.",
      fix: "Review whether each affected page should allow link traversal. If so, remove nofollow from its robots meta tag or X-Robots-Tag header. Keep intentional restrictions.",
      code: '<!-- Allow crawlers to follow links -->\n<meta name="robots" content="index, follow" />',
      effort: FixEffort.Trivial,
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
      if (hasNofollow(page)) pagesWithNofollow.push(page.url);
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
            priority: CheckPriority.High,
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
            priority: CheckPriority.Medium,
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
