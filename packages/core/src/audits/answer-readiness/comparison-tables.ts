import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import { hiddenFromReaders, readerText } from "#core/dom-visibility";
import { inPageChrome } from "#core/page-chrome";
import { weightForGrade } from "#core/scorer";
import type { CheckContext } from "#core/check-context";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
} from "#core/types";

// "vs" and "versus" must sit between two terms. A bare upper-case "VS" is
// left out: "Setting up VS Code" names a product.
// "Compare-at" is a product-page price label, and a heading that is only
// "Compare" labels a widget, not a comparison.
function comparisonIntent(text: string): boolean {
  if (/\S\s+(?:[vV]s\.?|VS\.|[vV]ersus|VERSUS)\s+\S/.test(text)) return true;
  if (/^compare$/i.test(text)) return false;
  return /\bcompar(?:e|ing|ison|isons)\b(?!-at\b)/i.test(text);
}

export class ComparisonTablesAudit extends Audit {
  static override meta: AuditMeta = {
    id: "answer-readiness/comparison-tables",
    category: "answer-readiness",
    title: "Comparison tables present",
    failureTitle: "Comparison tables present",
    description:
      "Reports semantic tables on pages with explicit comparison headings or captions. This is an unscored structure check, not a prediction of answer-engine citations.",
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: weightForGrade(EvidenceGrade.C, AuditTier.Informative),
    evidenceGrade: EvidenceGrade.C,
    tier: AuditTier.Informative,
    dossier: "docs/evidence/audits/answer-readiness/comparison-tables.md",
    requires: [
      EvidenceKey.OriginReachable,
      EvidenceKey.UnblockedFetches,
      EvidenceKey.RenderedBody,
      EvidenceKey.SampleAdequate,
    ],
    defaultPriority: CheckPriority.Low,
    guidance: {
      impact:
        "Tables can express aligned comparison data. No documented AI consumer requires them, and prose can also convey comparisons. This check does not predict citation rates.",
      fix: "Add HTML <table> elements with proper <thead> and <th> headers for any comparative content on your pages. Ensure each column has a descriptive header.",
      code: "<table>\n  <thead>\n    <tr><th>Feature</th><th>Plan A</th><th>Plan B</th></tr>\n  </thead>\n  <tbody>\n    <tr><td>Price</td><td>$10/mo</td><td>$20/mo</td></tr>\n    <tr><td>Storage</td><td>10 GB</td><td>50 GB</td></tr>\n  </tbody>\n</table>",
      effort: FixEffort.Easy,
      tags: ["content-structure", "html", "answer-engine"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    let relevant = 0;
    let marked = 0;
    for (const page of ctx.pages) {
      const $ = page.$;
      const visible = (el: Parameters<typeof hiddenFromReaders>[1]) =>
        !hiddenFromReaders($, el) && !inPageChrome($, el);
      const intent = $("h1, h2, h3, caption")
        .toArray()
        .some(
          (el) =>
            visible(el) &&
            comparisonIntent(readerText($, el).replace(/\s+/g, " ").trim()),
        );
      if (!intent) continue;
      relevant++;
      const hasTable = $("table")
        .toArray()
        .some((el) => {
          if (!visible(el) || $(el).is('[role="presentation"], [role="none"]'))
            return false;
          const table = $(el);
          const rows = table
            .find("tr")
            .toArray()
            .filter((row) => $(row).closest("table")[0] === el && visible(row));
          return (
            rows.some(
              (row) =>
                $(row)
                  .children("th")
                  .filter((_, cell) => visible(cell)).length >= 2,
            ) &&
            rows.some(
              (row) =>
                $(row)
                  .children("td")
                  .filter((_, cell) => visible(cell)).length >= 2,
            )
          );
        });
      if (hasTable) marked++;
    }
    const expected =
      "A semantic data table on pages with explicit comparison intent";
    if (!relevant)
      return this.notApplicable(
        "No explicit comparison content detected.",
        expected,
        "No relevant pages",
      );
    const found = `${marked}/${relevant} comparison pages have data tables`;
    if (marked === relevant) return this.pass(found, expected, found);
    if (marked) return this.warn(found, expected, found);
    return this.fail(
      "No data tables found on comparison pages.",
      expected,
      found,
    );
  }
}
