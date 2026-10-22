import type { Cheerio, CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import type { CheckContext } from "#core/check-context";
import { hiddenFromReaders } from "#core/dom-visibility";
import { weightForGrade } from "#core/scorer";
import { flattenJsonLd } from "#core/parser";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
} from "#core/types";

function matchesType(schema: Record<string, unknown>, type: string): boolean {
  const t = schema["@type"];
  if (typeof t === "string") return t === type;
  if (Array.isArray(t)) return t.includes(type);
  return false;
}

const BREADCRUMB_TOKEN = /(?:^|[^a-z])breadcrumbs?(?:[^a-z]|$)/i;
// State and toggle classes name a breadcrumb feature, not a trail:
// `has-breadcrumbs`, `no-breadcrumbs`, `breadcrumbs-disabled`.
const STATE_TOKEN =
  /^(?:has|no|show|hide|with|without)[-_]|[-_](?:disabled|hidden|off|none|on|enabled|active)$/i;

/** Whether an element's class, id or label names a breadcrumb trail. */
function breadcrumbHint(node: Cheerio<Element>): boolean {
  const tokens = [
    ...(node.attr("class") ?? "").split(/\s+/),
    node.attr("id") ?? "",
  ].filter((token) => BREADCRUMB_TOKEN.test(token) && !STATE_TOKEN.test(token));
  return (
    tokens.length > 0 || BREADCRUMB_TOKEN.test(node.attr("aria-label") ?? "")
  );
}

/**
 * Whether a candidate holds a breadcrumb trail of its own: two visible list
 * items, or two distinct targets counting a current-page marker. A page
 * wrapper that holds main content or a site banner is not a trail.
 */
function isTrail($: CheerioAPI, el: Element): boolean {
  const node = $(el);
  if (
    node.find(
      'main, header, article, [role="main"], [role="banner"], [role="article"]',
    ).length
  )
    return false;
  const links = node
    .find("a[href]")
    .toArray()
    .filter(
      (link) =>
        !hiddenFromReaders($, link) &&
        $(link).text().trim() &&
        $(link).attr("href")?.trim(),
    );
  if (!links.length) return false;
  const items = node
    .find("li")
    .toArray()
    .filter((item) => !hiddenFromReaders($, item) && $(item).text().trim());
  if (items.length >= 2) return true;
  const targets = new Set(links.map((link) => $(link).attr("href")));
  const current = node
    .find('[aria-current="page"]')
    .toArray()
    .some(
      (item) =>
        !hiddenFromReaders($, item) &&
        $(item).text().trim() &&
        !$(item).is("a[href]"),
    );
  return targets.size + Number(current) >= 2;
}

export class BreadcrumbSchemaAudit extends Audit {
  static override meta: AuditMeta = {
    id: "structured-data/breadcrumb-schema",
    category: "structured-data",
    title: "BreadcrumbList schema",
    failureTitle: "BreadcrumbList schema",
    description:
      "Google Search uses BreadcrumbList to categorize a page and may display its breadcrumb trail. This check looks for markup where a visible trail or existing BreadcrumbList establishes the feature.",
    scoreDisplayMode: ScoreDisplayMode.Ternary,
    weight: weightForGrade(EvidenceGrade.A, AuditTier.Scored),
    evidenceGrade: EvidenceGrade.A,
    tier: AuditTier.Scored,
    dossier: "docs/evidence/audits/structured-data/breadcrumb-schema.md",
    requires: [
      EvidenceKey.OriginReachable,
      EvidenceKey.UnblockedFetches,
      EvidenceKey.RenderedBody,
      EvidenceKey.SampleAdequate,
    ],
    defaultPriority: CheckPriority.Medium,
    guidance: {
      impact:
        "Google documents breadcrumb markup as a search presentation feature. It recommends typical user paths rather than URL depth; this check does not claim AI navigation or answer-quality effects.",
      fix: "Describe an existing breadcrumb trail with BreadcrumbList markup. Include position and name for each ListItem, plus item URLs except where Google allows omission for the final item. Do not invent a hierarchy from the URL.",
      code: `{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://yoursite.com/" },
    { "@type": "ListItem", "position": 2, "name": "Category", "item": "https://yoursite.com/category/" },
    { "@type": "ListItem", "position": 3, "name": "Current Page", "item": "https://yoursite.com/category/page/" }
  ]
}`,
      effort: FixEffort.Easy,
      docsUrl: "https://schema.org/BreadcrumbList",
      tags: ["json-ld", "schema", "navigation", "site-structure"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    let relevant = 0;
    let marked = 0;
    for (const page of ctx.pages) {
      const schemas = flattenJsonLd(page.structuredData ?? page.jsonLd);
      const hasSchema = schemas.some((schema) =>
        matchesType(schema as Record<string, unknown>, "BreadcrumbList"),
      );
      const $ = page.$;
      const hinted = $('nav, ol, ul, div, [role="navigation"]')
        .toArray()
        .filter((el) => breadcrumbHint($(el)) && !hiddenFromReaders($, el));
      // A hinted wrapper can hold the trail inside a plain <nav>; that nav is
      // assessed on its own as well as through the wrapper.
      const candidates = new Set([
        ...hinted,
        ...hinted.flatMap((el) =>
          $(el).find('nav, [role="navigation"]').toArray(),
        ),
      ]);
      const hasTrail = [...candidates].some((el) => isTrail($, el));
      if (!hasSchema && !hasTrail) continue;
      relevant++;
      if (hasSchema) marked++;
    }
    const expected = "BreadcrumbList markup for an observed breadcrumb trail";
    if (!relevant)
      return this.notApplicable(
        "No breadcrumb trail or BreadcrumbList detected; URL depth alone does not establish a hierarchy.",
        expected,
        "No relevant pages",
      );
    const found = `${marked}/${relevant} breadcrumb-bearing pages have BreadcrumbList`;
    if (marked === relevant) return this.pass(found, expected, found);
    if (marked) return this.warn(found, expected, found);
    return this.fail(
      "No BreadcrumbList markup found for observed breadcrumb trails.",
      expected,
      found,
    );
  }
}
