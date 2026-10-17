import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import type { CheckContext } from "#core/check-context";
import { parseRobotsTxt } from "./_robots-txt-helpers";
import { weightForGrade } from "#core/scorer";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
} from "#core/types";

const EXPECTED = "If Crawl-delay is present, it is <= 10 seconds";

export class CrawlDelayAudit extends Audit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/crawl-delay",
    category: "access-crawl-control",
    title: "Crawl-delay is reasonable",
    failureTitle: "Crawl-delay is reasonable",
    description:
      "Excessive Crawl-delay values (over 10 seconds) dramatically slow AI indexing, meaning your latest content may take days or weeks to appear in AI search results.",
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: weightForGrade(EvidenceGrade.C, AuditTier.Informative),
    evidenceGrade: EvidenceGrade.C,
    tier: AuditTier.Informative,
    dossier: "docs/evidence/audits/access-crawl-control/crawl-delay.md",
    // Gate exemption: being refused is what this category reports.
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    defaultPriority: CheckPriority.High,
    guidance: {
      impact:
        "Excessive Crawl-delay values (over 10 seconds) dramatically slow AI indexing, meaning your latest content may take days or weeks to appear in AI search results while competitors with lower delays get indexed faster.",
      fix: "Reduce Crawl-delay to 5 seconds or less, or remove it entirely if your server can handle the crawl load. Most modern servers can handle AI crawler traffic without throttling.",
      code: "User-agent: *\nCrawl-delay: 5",
      effort: FixEffort.Trivial,
      tags: ["robots-txt", "performance", "crawler-permissions"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const robotsFile = ctx.rootFiles["/robots.txt"];

    // Absent artifact, absent verdict. The dossier records that Crawl-delay is
    // not part of RFC 9309 and that Google and Amazon ignore it, so neither a
    // missing robots.txt nor a robots.txt without the directive costs the site
    // anything. Only a value that is present can be judged.
    if (!robotsFile || robotsFile.status !== 200 || !robotsFile.body) {
      return this.notApplicable(
        "No robots.txt found, so there is no Crawl-delay to judge.",
        EXPECTED,
        "No robots.txt found",
      );
    }

    const groups = parseRobotsTxt(robotsFile.body);
    const delays = groups
      .filter((g) => g.crawlDelay !== undefined)
      .map((g) => ({ userAgent: g.userAgent, crawlDelay: g.crawlDelay! }));

    if (delays.length === 0) {
      return this.notApplicable(
        "robots.txt sets no Crawl-delay, so there is nothing to judge.",
        EXPECTED,
        "No Crawl-delay directives present",
      );
    }

    const excessive = delays.filter((d) => d.crawlDelay > 10);

    if (excessive.length > 0) {
      const details = excessive
        .map((d) => `${d.userAgent}: ${d.crawlDelay}s`)
        .join(", ");
      return this.fail(
        `Excessive Crawl-delay values found: ${details}. Values above 10 seconds significantly slow down AI crawlers.`,
        EXPECTED,
        `Excessive delays: ${details}`,
        {
          priority: CheckPriority.High,
          description:
            "Excessive Crawl-delay values (over 10 seconds) dramatically slow AI indexing, meaning your latest content may take days or weeks to appear in AI search results. Reduce to 5 seconds or less, or remove the directive entirely if your server can handle the load.",
          code: "User-agent: *\nCrawl-delay: 5",
        },
      );
    }

    const allDetails = delays
      .map((d) => `${d.userAgent}: ${d.crawlDelay}s`)
      .join(", ");
    return this.pass(
      `Crawl-delay values are reasonable: ${allDetails}`,
      EXPECTED,
      `Crawl-delays: ${allDetails}`,
    );
  }
}
