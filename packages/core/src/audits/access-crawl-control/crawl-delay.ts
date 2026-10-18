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

/**
 * Crawlers whose operators document that they ignore Crawl-delay: Google
 * ("other fields such as crawl-delay aren't supported"), Amazonbot ("They do
 * not support the crawl-delay directive") and Applebot ("Applebot does not
 * follow crawl-delay"). A delay addressed only to them throttles nothing, so
 * it is not judged. Matched on the product token. Google's crawler tokens
 * start with "Google" (Googlebot-Image, GoogleOther, Google-Extended) or end
 * with "-Google" (AdsBot-Google, Storebot-Google, APIs-Google); a token that
 * only contains the word belongs to some other crawler and is judged.
 */
function ignoresCrawlDelay(userAgent: string): boolean {
  const product = userAgent.trim().toLowerCase().split("/")[0] ?? "";
  return (
    product.startsWith("google") ||
    product.endsWith("-google") ||
    product === "amazonbot" ||
    product === "applebot" ||
    product === "applebot-extended"
  );
}

export class CrawlDelayAudit extends Audit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/crawl-delay",
    category: "access-crawl-control",
    title: "Crawl-delay is reasonable",
    failureTitle: "Crawl-delay is reasonable",
    description:
      "Checks the Crawl-delay values robots.txt sets for crawlers that honour the directive (Anthropic's crawlers, Bingbot, CCBot, YouBot). Bing recommends no value above 10 seconds. Groups addressed only to Google, Amazonbot or Applebot are not judged: those crawlers document that they ignore Crawl-delay.",
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
        "Crawlers that honour Crawl-delay wait that long between requests, so a large value caps how many pages they can fetch in a day. Bing recommends against any value higher than 10. Google, Amazonbot and Applebot ignore the directive.",
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

    const judged = delays.filter((d) => !ignoresCrawlDelay(d.userAgent));
    if (judged.length === 0) {
      const ignored = delays
        .map((d) => `${d.userAgent}: ${d.crawlDelay}s`)
        .join(", ");
      return this.notApplicable(
        `robots.txt sets Crawl-delay only for crawlers that document they ignore it (${ignored}), so it throttles nothing.`,
        EXPECTED,
        `Crawl-delays for ignoring crawlers only: ${ignored}`,
      );
    }

    const excessive = judged.filter((d) => d.crawlDelay > 10);

    if (excessive.length > 0) {
      const details = excessive
        .map((d) => `${d.userAgent}: ${d.crawlDelay}s`)
        .join(", ");
      return this.fail(
        `Excessive Crawl-delay values found: ${details}. Crawlers that honour the directive wait that long between requests.`,
        EXPECTED,
        `Excessive delays: ${details}`,
        {
          priority: CheckPriority.High,
          description:
            "Anthropic's crawlers, Bingbot, CCBot and YouBot wait the Crawl-delay value between requests, and Bing recommends against any value higher than 10. Reduce it to 10 seconds or less, or remove the directive if your server can handle the load.",
          code: "User-agent: *\nCrawl-delay: 5",
        },
      );
    }

    const allDetails = judged
      .map((d) => `${d.userAgent}: ${d.crawlDelay}s`)
      .join(", ");
    return this.pass(
      `Crawl-delay values are reasonable: ${allDetails}`,
      EXPECTED,
      `Crawl-delays: ${allDetails}`,
    );
  }
}
