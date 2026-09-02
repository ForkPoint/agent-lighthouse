import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from "../../scorer";
import type { CheckContext } from "../../check-context";

export class ComparisonTablesAudit extends Audit {
  static override meta: AuditMeta = {
    id: "answer-readiness/comparison-tables",
    category: "answer-readiness",
    title: "Comparison tables present",
    failureTitle: "Comparison tables present",
    description:
      "AI answer engines extract structured table data to generate comparison answers. Add HTML tables to your content where appropriate.",
    scoreDisplayMode: "informative",
    weight: weightForGrade("C", "informative"),
    evidenceGrade: "C",
    tier: "informative",
    dossier: "docs/evidence/audits/answer-readiness/comparison-tables.md",
    requires: [
      "origin-reachable",
      "unblocked-fetches",
      "rendered-body",
      "sample-adequate",
    ],
    applicablePageTypes: ["category", "product", "content"],
    defaultPriority: "low",
    guidance: {
      impact:
        'AI answer engines extract structured table data to generate comparison answers for queries like "What is the difference between X and Y?" Without HTML tables, your comparison content is harder for agents to parse and less likely to appear as a structured answer.',
      fix: "Add HTML <table> elements with proper <thead> and <th> headers for any comparative content on your pages. Ensure each column has a descriptive header.",
      code: "<table>\n  <thead>\n    <tr><th>Feature</th><th>Plan A</th><th>Plan B</th></tr>\n  </thead>\n  <tbody>\n    <tr><td>Price</td><td>$10/mo</td><td>$20/mo</td></tr>\n    <tr><td>Storage</td><td>10 GB</td><td>50 GB</td></tr>\n  </tbody>\n</table>",
      effort: "easy",
      tags: ["content-structure", "html", "answer-engine"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    if (!page) {
      return this.fail(
        "No pages scanned.",
        "<table> elements with comparison data",
        "No pages scanned",
        {
          priority: "low",
          description: ComparisonTablesAudit.meta.description,
          code: "<table>\n  <thead><tr><th>Feature</th><th>Plan A</th><th>Plan B</th></tr></thead>\n  <tbody><tr><td>Price</td><td>$10</td><td>$20</td></tr></tbody>\n</table>",
        },
      );
    }

    let tableCount = 0;
    let pageWithTable: string | undefined;

    for (const p of ctx.pages) {
      const tables = p.$("table").length;
      if (tables > 0) {
        tableCount += tables;
        if (!pageWithTable) {
          pageWithTable = p.url;
        }
      }
    }

    if (tableCount > 0) {
      return this.pass(
        `Found ${tableCount} table(s) across scanned pages.`,
        "<table> elements with comparison data",
        `${tableCount} table(s)`,
        pageWithTable,
      );
    }

    return this.fail(
      "No comparison tables found on any scanned page.",
      "<table> elements with comparison data",
      "Not found",
      {
        priority: "low",
        description:
          'AI answer engines extract HTML tables to generate structured comparison answers ("What is the difference between X and Y?"). Properly structured tables with <thead> and <th> are directly rendered in AI-generated responses, giving your content prime visibility in comparison queries.',
        code: "<table>\n  <thead><tr><th>Feature</th><th>Plan A</th><th>Plan B</th></tr></thead>\n  <tbody><tr><td>Price</td><td>$10</td><td>$20</td></tr></tbody>\n</table>",
      },
      page.url,
    );
  }
}
