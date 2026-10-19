import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import { weightForGrade } from "#core/scorer";
import type { CheckContext, PageContext } from "#core/check-context";
import { flattenJsonLd } from "#core/parser";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  NoticeKind,
  ScoreDisplayMode,
} from "#core/types";

/** `@type` is legally a string or an array of strings; compare against both. */
function hasType(node: Record<string, unknown>, type: string): boolean {
  const t = node["@type"];
  if (typeof t === "string") return t === type;
  if (Array.isArray(t)) return t.includes(type);
  return false;
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** The first SearchAction on a crawled page, with its URL template if any. */
interface FoundSearchAction {
  pageUrl: string;
  urlTemplate?: string;
}

/**
 * Find a published `SearchAction`.
 *
 * Reads `structuredData` (JSON-LD + Microdata + RDFa) when the gatherer
 * produced it and falls back to raw JSON-LD, then runs the blocks through the
 * shared deep flattener so a SearchAction nested under `potentialAction`,
 * inside a top-level array or behind `@graph` is found the same way.
 */
function findSearchAction(
  pages: readonly PageContext[],
): FoundSearchAction | undefined {
  for (const page of pages) {
    const nodes = flattenJsonLd(page.structuredData ?? page.jsonLd) as Record<
      string,
      unknown
    >[];
    for (const node of nodes) {
      if (!hasType(node, "SearchAction")) continue;
      const urlTemplate = asArray(node["target"])
        .map((target) =>
          isObject(target) && typeof target["urlTemplate"] === "string"
            ? target["urlTemplate"]
            : typeof target === "string"
              ? target
              : undefined,
        )
        .find((template) => template !== undefined);
      return urlTemplate === undefined
        ? { pageUrl: page.url }
        : { pageUrl: page.url, urlTemplate };
    }
  }
  return undefined;
}

const SOURCE_URL =
  "https://developers.google.com/search/blog/2024/10/sitelinks-search-box";

export class SearchEndpointAudit extends Audit {
  static override meta: AuditMeta = {
    id: "agent-interfaces/search-endpoint",
    category: "agent-interfaces",
    // An obsolete audit speaks only when the owner still publishes the
    // markup, so both titles describe the markup.
    title: "WebSite SearchAction markup (retired)",
    failureTitle: "Retired SearchAction markup is still published",
    description:
      "Reports a Schema.org `SearchAction` still published in a page's structured data. Its only documented consumer was Google's sitelinks search box, which Google removed on 2024-11-21, and no AI vendor documents reading the markup. Google says the markup does no harm and need not be removed. The `WebSite` node around it still matters: Google uses it for site names.",
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: weightForGrade(EvidenceGrade.D, AuditTier.Obsolete),
    evidenceGrade: EvidenceGrade.D,
    tier: AuditTier.Obsolete,
    deprecated: {
      kind: NoticeKind.Obsolete,
      notice:
        "Google removed the sitelinks search box on 2024-11-21, and no AI vendor reads SearchAction. The markup does no harm.",
      link: SOURCE_URL,
      replacement:
        "Nothing is needed. Keep the WebSite markup with name and url: Google still uses it for site names.",
    },
    dossier: "docs/evidence/audits/agent-interfaces/search-endpoint.md",
    requires: [
      EvidenceKey.OriginReachable,
      EvidenceKey.UnblockedFetches,
      EvidenceKey.RenderedBody,
      EvidenceKey.SampleAdequate,
    ],
    defaultPriority: CheckPriority.Low,
    guidance: {
      impact:
        "None in either direction. Google stopped showing the sitelinks search box in November 2024 and no AI vendor documents reading SearchAction, so the markup neither helps nor hurts.",
      fix: "Nothing is required. Removing the SearchAction is optional; Google says there is no need to. If you remove it, keep the surrounding WebSite node with its name and url, because Google uses it for site names.",
      effort: FixEffort.Trivial,
      docsUrl: SOURCE_URL,
      tags: ["search", "schema-org", "sitelinks-search-box", "obsolete"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const expected =
      "No SearchAction is needed: its only documented consumer was retired in 2024";
    const found = findSearchAction(ctx.pages);

    // Absent artifact, absent verdict. The obsolete tier speaks only about
    // markup the owner still publishes. The search URL is not probed: the
    // markup is the finding, and nothing reads the template.
    if (!found) {
      return this.notApplicable(
        "No page publishes a SearchAction, so there is nothing to retire.",
        expected,
        "No SearchAction found",
      );
    }

    return this.warn(
      "A WebSite SearchAction is published. Google removed the sitelinks search box it fed on 2024-11-21, and no AI vendor reads SearchAction. Removal is optional: Google says there is no need to remove it. Keep the WebSite markup itself, which Google uses for site names.",
      expected,
      found.urlTemplate
        ? `SearchAction with URL template ${found.urlTemplate}`
        : "SearchAction with no URL template",
      CheckPriority.Low,
      found.pageUrl,
    );
  }
}
